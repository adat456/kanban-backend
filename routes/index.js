var express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { isEmail } = require("validator");
const arrayMove = require("array-move");

const UserModel = require("../models/UserModel");
const BoardModel = require("../models/BoardModel");
const NotificationModel = require("../models/NotificationModel");

// setting up redis connection
let redisClient = null;
(async () => {
  redisClient = redis.createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-12581.c266.us-east-1-3.ec2.cloud.redislabs.com',
        port: 12581
    },
  });

  redisClient.on("error", error => {
    console.log(error);
  });
  redisClient.on("connect", () => {
    console.log("Redis connected!");
  });

  await redisClient.connect();
})();

/* authentication middleware */
async function authenticate(req, res, next) {
  const token = req.cookies.jwt;

  try {
    // if there's a JWT token, will check if it's on the blacklist first--if it's not, pull its info and proceed to the actual route handler
    if (token) {
      const onBlacklist = await redisClient.get(`blacklist_${token}`);
      if (onBlacklist) {
        throw new Error("JWT rejected.");
      } else {
        const decodedToken = await jwt.verify(token, process.env.JWT_SECRET);
        res.locals.userId = decodedToken.id;
        const userDoc = await UserModel.findOne({ _id: res.locals.userId });
        res.locals.user = userDoc;
        next();
      }
    } else {
      res.locals.userId = null;
      throw new Error("No JWT found.");
    };
  } catch(err) {
    res.locals.userId = null;
    next(err);
  };
};

router.get("/user-info", authenticate, async function(req, res, next) {
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    if (userDoc) {
      res.status(200).json(userDoc);
    } else {
      throw new Error("Unable to retrieve user data.");
    };
  } catch(err) {
    next(err);
  };
});

/* read all info */
router.get("/read-all", authenticate, async function (req, res, next) {
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    if (userDoc) {
      const populatedUserDoc = await userDoc.populate("boards");
      res.status(200).json(populatedUserDoc.boards);
    } else {
      throw new Error("Unable to retrieve existing board data.");
    };
  } catch(err) {
    next(err);
  };  
});

router.get("/get-notifications", authenticate, async function(req, res, next) {
  try {
    const notificationDocs = await NotificationModel.find({ recipientId: res.locals.userId });
    if (notificationDocs) {
      res.status(200).json(notificationDocs);
    } else {
      throw new Error("Unable to retrieve notifications.");
    };
  } catch(err) {
    next(err);
  };
})

/* create board - receives name and columns */
router.post("/create-board", authenticate, async function(req, res, next) {
  const { name, columns, creator, contributors } = req.body;
  const trimmedBoardName = name.trim();
  
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });

    // populates the board info in the user doc so that board names can be compared
    const populatedUserDoc = await userDoc.populate("boards");
    populatedUserDoc.boards.forEach(board => {
      if (board.name.toLowerCase() === trimmedBoardName.toLowerCase()) {
        throw new Error("Cannot create a board with the same name.");
      };
    });

    // since error was not thrown, a new board is created, with the signed in user set as the creator
    // it is also added to one or multiple boards, depending on whether there are any contributors
    let boardDoc;
    if (contributors) {
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, creator, contributors });
      // board's objectid added to all of the contributors' boards arrays
      contributors.forEach(async contributor => {
        // connectedSocket.emit("contributor-message", `You've been added to the "${trimmedBoardName}" board as a contributor.`);
        const notificationDoc = await NotificationModel.create({
          recipientId: new mongoose.Types.ObjectId(contributor.userId),
          senderId: populatedUserDoc._id,
          senderFullName: populatedUserDoc.firstName + " " + populatedUserDoc.lastName,
          message: `You've been added to the "${trimmedBoardName}" board as a ${contributor.userStatus.toLowerCase()}.`,
          sent: new Date(),
          acknowledged: false,
        });
        
        const userDoc = await UserModel.findOne({ _id: contributor.userId });
        userDoc.boards = [...userDoc.boards, boardDoc._id];

        await userDoc.save();
      });
      // ...and the signed-in user's
      
    } else {
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, creator });
    };

    // board's objectid added only to the signed-in user's boards array
    userDoc.boards = [...userDoc.boards, boardDoc._id];
    await userDoc.save();
    
    res.status(200).json(boardDoc);
  } catch(err) {
    next(err);
  };
});

/* update board */
router.post("/update-board", authenticate, async function(req, res, next) {
  const { name, boardId, columns, contributors } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });

    // check if the signed in user is either the creator or a co-creator
    const isCreator = boardDoc.creator.userId === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      boardDoc.name = name.trim();

      // COLUMN WORK
      let existingColumns = boardDoc.columns;
      let newColumns = [];
      columns.forEach(column => {
        // updating existing column if there is an ID (longer than 5 characters) and a name
        if (column.id.length > 5 && column.name) {
          existingColumns.forEach(existingCol => {
            if (column.id === existingCol._id.toString()) {
              existingCol.name = column.name;
            };
          });
        };

        // adding new column if there is an ID (shorter than 5 characters, i.e., generated by the front end) and a name
        if (column.id.length < 5 && column.name) {
          newColumns.push({ name: column.name });
        };

        // removing existing column if there is an ID (longer than 5 characters) but no name
        if (column.id.length > 5 && !column.name) {
          existingColumns = existingColumns.filter(existingCol => (column.id !== existingCol._id.toString()));
        };
      });
      boardDoc.columns = [...existingColumns, ...newColumns];

      // CONTRIBUTOR WORK
      // arrays of users that require work on the user model end
      let removedContributors = [];
      boardDoc.contributors.forEach(existingContributor => {
        // is there a match for the existing contributor in the new contributors array based on userId? if not, add existing contributor to removal list
        const matchingContributor = contributors.find(contributor => contributor.userId === existingContributor.userId);
        if (!matchingContributor) removedContributors.push(existingContributor);
      });
      let addedContributors = [];
      contributors.forEach(contributor => {
        // is there a match for the new contributor in the existing contributors array based on userId? if not, add new contributor to add list
        const matchingContributor = boardDoc.contributors.find(existingContributor => existingContributor.userId === contributor.userId);
        if (!matchingContributor) addedContributors.push(contributor);
      });
      // delete boardIds from all users in removedContributors
      removedContributors.forEach(async contributor => {
        const userDoc = await UserModel.findOne({ _id: contributor.userId });
        userDoc.boards = userDoc.boards.filter(board => board._id.toString() !== boardId);
        await userDoc.save();
      });
      // add boardIds to all users in addedContributors
      addedContributors.forEach(async contributor => {
        const notificationDoc = await NotificationModel.create({
          recipientId: new mongoose.Types.ObjectId(contributor.userId),
          senderId: res.locals.userId,
          senderFullName: res.locals.user.firstName + " " + res.locals.user.lastName,
          message: `You've been added to the "${name.trim()}" board as a ${contributor.userStatus.toLowerCase()}.`,
          sent: new Date(),
          acknowledged: false,
        });

        const userDoc = await UserModel.findOne({ _id: contributor.userId });
        userDoc.boards.push(boardId);
        await userDoc.save();
      });
      // completely replace existing contributor array with new contributor array (update and add)
      boardDoc.contributors = contributors;

      await boardDoc.save();
      res.status(200).json(boardDoc);
    } else {
      throw new Error("You do not have the ability to edit this board. Please contact the board creator.");
    };
  } catch(err) {
    next(err);
  };
});

/* toggle favorite status on board */
router.post("/update-board-favorite", authenticate, async function(req, res, next) {
  const { boardId } = req.body;

  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    if (userDoc) {
      if (userDoc.favorites.includes(boardId)) {
        userDoc.favorites = userDoc.favorites.filter(favoriteBoard => favoriteBoard !== boardId);
      } else {
        userDoc.favorites.push(boardId);
      };
      
      await userDoc.save();
      res.status(200).send(userDoc);
    } else {
      throw new Error("Could not find board.")
    }
  } catch (err) {
    next(err);
  };
});

/* delete board */
router.delete("/delete-board/:boardId", authenticate, async function(req, res, next) {
  const boardId = req.params.boardId;

  try {
    // find the board 
    const boardDoc = await BoardModel.findOne({ _id: boardId });

    // check if the signed in user is either the creator or a co-creator
    const isCreator = boardDoc.creator.userId === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      // if there are contributors, delete boardId from their board arrays
      if (boardDoc.contributors.length > 0) {
        boardDoc.contributors.forEach(async contributor => {
          const notificationDoc = await NotificationModel.create({
            recipientId: new mongoose.Types.ObjectId(contributor.userId),
            senderId: res.locals.userId,
            senderFullName: res.locals.user.firstName + " " + res.locals.user.lastName,
            message: `The "${boardDoc.name}" board was deleted.`,
            sent: new Date(),
            acknowledged: false,
          });

          const userDoc = await UserModel.findOne({ _id: contributor.userId });
          const updatedBoardArr = userDoc.boards.filter(id => id.toString() !== boardId);
          userDoc.boards = updatedBoardArr;
          await userDoc.save();
        });
      };

      // delete boardId from the creator's board array
      const userDoc = await UserModel.findOne({ _id: boardDoc.creator.userId });
      const updatedBoardArr = userDoc.boards.filter(id => id.toString() !== boardId);
      userDoc.boards = updatedBoardArr;
      await userDoc.save();

      // delete the board itself
      await BoardModel.deleteOne({ _id: boardId });

      res.status(200).json("Board deleted.");
    } else {
      throw new Error("You do not have the ability to delete this board. Please contact the board creator.");
    };
  } catch(err) {
    next(err);
  };
});

/* create task */
router.post("/create-task", authenticate, async function(req, res, next) {
  // subtasks should be formatted already as an array of objects 
  const { boardId, columnId, task, desc, subtasks, created, deadline, assignees, completed } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });

    // check if the signed in user is either the creator or a co-creator
    const isCreator = boardDoc.creator.userId === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      if (assignees) assignees.forEach(async assignee => {
        const notificationDoc = await NotificationModel.create({
          recipientId: new mongoose.Types.ObjectId(assignee.userId),
          senderId: res.locals.userId,
          senderFullName: res.locals.user.firstName + " " + res.locals.user.lastName,
          message: `You've been assigned to the "${task}" task in the "${boardDoc.name}" board.`,
          sent: new Date(),
          acknowledged: false,
        });
      });

      const columnDoc = boardDoc.columns.id(columnId);
      columnDoc.tasks = [
        ...columnDoc.tasks,
        { task, desc, subtasks, created, deadline, assignees, completed }
      ];
      await boardDoc.save();
      res.status(200).json(boardDoc);
    } else {
      throw new Error("You do not have the ability to add tasks. Please contact the board creator.");
    };
  } catch(err) {
    next(err);
  };
});

/* update task - for updating subtask status, who subtask was completed by, changing the task column, and updating task completion */
router.post("/update-task", authenticate, async function(req, res, next) {
  const { userStatus, boardId, colId, taskId, taskOrder, updatedSubtasks = undefined, updatedTaskOrder = undefined, updatedColId, completed, completionDate } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    // can string multiple find commands to access deeply nested subdocs
    const curTaskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

    if (userStatus !== "Viewer") {
      if (updatedSubtasks) {
        updatedSubtasks.forEach(async (updatedSubtask) => {
          // make sure there's an ID matched subtask in database
          const subtaskDoc = await curTaskDoc.subtasks.id(updatedSubtask.id);
          if (subtaskDoc) {
            // if there is a match, update the status and completedBy object
            subtaskDoc.status = updatedSubtask.status;
            subtaskDoc.completedBy = updatedSubtask.completedBy;
          };
        });
  
        await boardDoc.save();
      };
  
      // need to check that the completed property even came in, because drag and drop task function also uses this route, but does NOT send a completed or completionDate property
      // if we did not check that this prop exists, we would have unwanted side effects, with tasks mysteriously becoming incomplete
      if (req.body.hasOwnProperty("completed")) {
        if (completed) {
          // notifying all task assignees
          curTaskDoc.assignees.forEach(async assignee => {
            const notificationDoc = await NotificationModel.create({
              recipientId: new mongoose.Types.ObjectId(assignee.userId),
              message: `The "${curTaskDoc.task}" task has been completed.`,
              sent: new Date(),
              acknowledged: false,
            });
          });
    
          // and the task creator
          const notificationDoc = await NotificationModel.create({
            recipientId: boardDoc.creator.userId,
            message: `The "${curTaskDoc.task}" task has been completed.`,
            sent: new Date(),
            acknowledged: false,
          });
    
          curTaskDoc.completed = completed;
          curTaskDoc.completionDate = completionDate;
        } else {
          // if marked as incomplete, set to an empty string
          curTaskDoc.completed = completed;
          curTaskDoc.completionDate = "";
        };
      };
  
      // UPDATING COLUMN AND ORDER
  
      // same column, different order
      if (colId === updatedColId) {
        const curColumnDoc = await boardDoc.columns.id(colId);
        curColumnDoc.tasks = arrayMove(curColumnDoc.tasks, taskOrder, updatedTaskOrder);
      };
  
      // different column
      if (colId !== updatedColId) {
        // order specified - split task array in half and join with new task in the middle
        if (updatedTaskOrder >= 0) {
          const curTaskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);
          const updatedColumnDoc = await boardDoc.columns.id(updatedColId);
          const firstHalfTaskArr = updatedColumnDoc.tasks.slice(0, updatedTaskOrder);
          const secondHalfTaskArr = updatedColumnDoc.tasks.slice(updatedTaskOrder);
          updatedColumnDoc.tasks = [...firstHalfTaskArr, curTaskDoc, ...secondHalfTaskArr]
        } else {
          // no order specified - moving to empty column OR if using the edit task form - just add the task to the end of the task array
          const curTaskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);
          const updatedColumnDoc = await boardDoc.columns.id(updatedColId);
          updatedColumnDoc.tasks = [...updatedColumnDoc.tasks, curTaskDoc];
        };
  
        // clean up - filtering the task from the current column's task arr
        const curColumnDoc = await boardDoc.columns.id(colId);
        curColumnDoc.tasks = curColumnDoc.tasks.filter(task => {
          return (task._id.toString() !== taskId);
        }); 
      };
  
      await boardDoc.save();
      res.status(200).json(boardDoc);
    } else {
      throw new Error("You do not have the ability to update or complete subtasks. Please contact the board creator.");
    };
  } catch(err) {
    next(err);
  };
});

/* edit task - for editing task name, description, subtasks, AND column */
router.post("/edit-task", authenticate, async function(req, res, next) {
  const { boardId, colId, taskId, task, desc, updatedSubtasks, updatedColId, assignees, deadline } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });

    // check if the signed in user is either the creator or a co-creator
    const isCreator = boardDoc.creator.userId === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      const taskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

      taskDoc.task = task;
      taskDoc.desc = desc;
      taskDoc.deadline = deadline;

      if (taskDoc.assignees) {
        // finding new assignees and sending notifications
        let newAssignees = [];
        assignees.forEach(assignee => {
          const match = taskDoc.assignees.find(existingAssignee => existingAssignee.userId === assignee.userId);
          if (!match) newAssignees.push(assignee);
        });
        newAssignees.forEach(async assignee => {
          const notificationDoc = await NotificationModel.create({
            recipientId: new mongoose.Types.ObjectId(assignee.userId),
            senderId: res.locals.userId,
            senderFullName: res.locals.user.firstName + " " + res.locals.user.lastName,
            message: `You've been assigned to the "${taskDoc.task}" task in the "${boardDoc.name}" board.`,
            sent: new Date(),
            acknowledged: false,
          });
        });
        taskDoc.assignees = assignees;
      };

      let existingSubtasks = taskDoc.subtasks;
      let newSubtasks = [];
      updatedSubtasks.forEach(subtask => {
        // updating existing column if there is an ID (longer than 5 characters) and a name
        if (subtask.id.length > 5 && subtask.name) {
          existingSubtasks.forEach(existingSubtask => {
            if (subtask.id === existingSubtask._id.toString()) {
              existingSubtask.subtask = subtask.name;
            };
          });
        };

        // adding new column if there is an ID (shorter than 5 characters, i.e., generated by the front end) and a name
        if (subtask.id.length < 5 && subtask.name) {
          newSubtasks.push({ subtask: subtask.name, status: false });
        };

        // removing existing column if there is an ID (longer than 5 characters) but no name
        if (subtask.id.length > 5 && !subtask.name) {
          existingSubtasks = existingSubtasks.filter(existingSubtask => (subtask.id !== existingSubtask._id.toString()));
        };
      });
      taskDoc.subtasks = [...existingSubtasks, ...newSubtasks];

      if (colId !== updatedColId) {
        // adding task to new column
        let updatedColumnDoc = await boardDoc.columns.id(updatedColId);
        let updatedTaskArr = updatedColumnDoc.tasks;
        const taskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);
        updatedTaskArr = [...updatedTaskArr, taskDoc];      console.log(updatedTaskArr);
        updatedColumnDoc.tasks = updatedTaskArr;

        // removing task from current column
        let curColumnDoc = await boardDoc.columns.id(colId);
        curColumnDoc.tasks = curColumnDoc.tasks.filter(task => {
          return (task._id.toString() !== taskId);
        });
      };

      await boardDoc.save();
      res.status(200).json(boardDoc);
    } else {
      throw new Error("You do not have the ability to edit this task. Please contact the board creator.");
    };
  } catch(err) {
    next(err);
  };
});

/* delete task */
router.delete("/delete-task/:boardId/:columnId/:taskId", authenticate, async function (req, res, next) {
   const { boardId, columnId, taskId } = req.params;

   try {
     const boardDoc = await BoardModel.findOne({ _id: boardId });

     // check if the signed in user is either the creator or a co-creator
      const isCreator = boardDoc.creator.userId === res.locals.userId;
      const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
      if (isCreator || isCocreator) {
        const columnDoc = await boardDoc.columns.id(columnId);
        console.log(columnDoc);

        // notifying task assignees
        const taskDoc = await columnDoc.tasks.id(taskId);

        if (taskDoc.assignees.length > 0) taskDoc.assignees.forEach(async assignee => {
          const notificationDoc = await NotificationModel.create({
            recipientId: new mongoose.Types.ObjectId(assignee.userId),
            senderId: res.locals.userId,
            senderFullName: res.locals.user.firstName + " " + res.locals.user.lastName,
            message: `The "${taskDoc.task}" task in the "${boardDoc.name}" board was deleted.`,
            sent: new Date(),
            acknowledged: false,
          });
        });

        // removing the actual task
        columnDoc.tasks = columnDoc.tasks.filter(task => {
          return (task._id.toString() !== taskId);
        });

        await boardDoc.save();
        res.status(200).json(boardDoc);
      } else {
        throw new Error("You do not have the ability to delete this task. Please contact the board creator.");
      }
    } catch(err) {
     next(err);
  };
});

/* pull users for possible contributors */
router.get("/search/:searchTerm", authenticate, async function(req, res, next) {
  const searchTerm = req.params.searchTerm.trim().toLowerCase();

  try {
    if (isEmail(searchTerm)) {
      // if it's an email
      const userDoc = await UserModel.findOne({ email: searchTerm })
      if (userDoc) {
        console.log(userDoc);
        res.status(200).json({ 
          userId: userDoc._id, 
          userName: userDoc.firstName + " " + userDoc.lastName,
          userStatus: "Member"
        });
      } else {
        throw new Error("Unable to find matching user by email.");
      };
    } else {
      const userDoc = await UserModel.findOne({ username: searchTerm })
      if (userDoc) {
        res.status(200).json({ 
          userId: userDoc._id, 
          userName: userDoc.firstName + " " + userDoc.lastName,
          userStatus: "Member"
        });
      } else {
        throw new Error("Unable to find matching user by username.");
      };
    };
  } catch(err) {
    next(err);
  };
});

router.post("/acknowledge-notifications", authenticate, async function(req, res, next) {
  const acknowledged = req.body;

  try {
    acknowledged.forEach(async notifId => {
      await NotificationModel.deleteOne({ _id: notifId });
    });
    res.status(200).json("Notifications acknowledged and deleted.");
  } catch(err) {
    next(err);
  };
});

module.exports = router;
