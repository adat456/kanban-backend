var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { isNumeric, isEmail } = require("validator");
const arrayMove = require("array-move");

const UserModel = require("../models/UserModel");
const BoardModel = require("../models/BoardModel");

// setting up redis connection
let redisClient = null;
(async () => {
  redisClient = redis.createClient();

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
        next();
      }
    } else {
      res.locals.userId = null;
      throw new Error("No token received. Please log in.");
    };
  } catch(err) {
    res.locals.userId = null;
    next(err);
  };
};

router.get("/user-info", authenticate, async function(req, res, next) {
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    res.status(200).json(userDoc);
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

// only read-board should receive the board name, because it is pulling the board id for future routes
/* read board/tasks */
router.get("/read-board/:name", authenticate, async function(req, res, next) {
  let boardName;
  // accepts either board ID or board name (which is converted from hyphenated to spaced)
  if (isNumeric(req.params.name)) {
    boardName = req.params.name;
  } else {
    boardName = req.params.name.trim().toLowerCase().split("-").join(" ");
  };

  try {
    const populatedUserDoc = await UserModel.findOne({ _id: res.locals.userId }).populate("boards");
    populatedUserDoc.boards.forEach(board => {
      // .toString() is used to convert Mongoose ObjectIds to strings for comparison purposes, etc.
      if (board.name.toLowerCase() === boardName || board._id.toString() === boardName) {
        res.status(200).json(board);
      };
      // removed else clause that threw an error because it would throw an error at the first mismatch and automatically route to the catch clause
    });
  } catch(err) {
    next(err);
  };
});

/* create board - receives name and columns */
router.post("/create-board", authenticate, async function(req, res, next) {
  const { name, columns, contributors } = req.body;
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
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, creator: res.locals.userId, contributors });
      // board's objectid added to all of the contributors' boards arrays
      contributors.forEach(async contributor => {
        const userDoc = await UserModel.findOne({ _id: contributor.userId });
        userDoc.boards = [...userDoc.boards, boardDoc._id];
        await userDoc.save();
      });
      // ...and the signed-in user's
      
    } else {
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, creator: res.locals.userId });
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
    const isCreator = boardDoc.creator.toString() === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      boardDoc.name = name;

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
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    if (boardDoc) {
      boardDoc.favorite = !boardDoc.favorite;
      await boardDoc.save();
      res.status(200).send(boardDoc);
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
    const isCreator = boardDoc.creator.toString() === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      // if there are contributors, delete boardId from their board arrays
      if (boardDoc.contributors.length > 0) {
        boardDoc.contributors.forEach(async contributor => {
          const userDoc = await UserModel.findOne({ _id: contributor.userId });
          const updatedBoardArr = userDoc.boards.filter(id => id.toString() !== boardId);
          userDoc.boards = updatedBoardArr;
          await userDoc.save();
        });
      };

      // delete boardId from the creator's board array
      const userDoc = await UserModel.findOne({ _id: boardDoc.creator });
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
  const { boardId, columnId, task, desc, subtasks, created, deadline, assignees } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });

    // check if the signed in user is either the creator or a co-creator
    const isCreator = boardDoc.creator.toString() === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      const columnDoc = boardDoc.columns.id(columnId);
      columnDoc.tasks = [
        ...columnDoc.tasks,
        { task, desc, subtasks, created, deadline, assignees }
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

/* update task - just for updating subtask status and changing the column */
router.post("/update-task", authenticate, async function(req, res, next) {
  const { boardId, colId, taskId, taskOrder, updatedSubtasks = undefined, updatedTaskOrder = undefined, updatedColId } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    // can string multiple find commands to access deeply nested subdocs
    const curTaskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

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
    const isCreator = boardDoc.creator.toString() === res.locals.userId;
    const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
    if (isCreator || isCocreator) {
      const taskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

      taskDoc.task = task;
      taskDoc.desc = desc;
      taskDoc.deadline = deadline;
      taskDoc.assignees = assignees;

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
      const isCreator = boardDoc.creator.toString() === res.locals.userId;
      const isCocreator = boardDoc.contributors.find(contributor => (contributor.userId === res.locals.userId && contributor.userStatus === "Co-creator"));
      if (isCreator || isCocreator) {
        const columnDoc = await boardDoc.columns.id(columnId);
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

module.exports = router;
