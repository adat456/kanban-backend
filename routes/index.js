var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { isNumeric } = require("validator");
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

    // since error was not thrown, a new board is created
    // it is also added to one or multiple boards, depending on whether there are any contributors
    let boardDoc;
    if (contributors) {
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, group: true, contributors });
      // board's objectid added to all of the contributors' boards arrays...
      contributors.forEach(async contributor => {
        const userDoc = await UserModel.findOne({ _id: contributor.userId });
        userDoc.boards = [...userDoc.boards, boardDoc._id];
        await userDoc.save();
      });
      // ...and the signed-in user's
      userDoc.boards = [...userDoc.boards, boardDoc._id];
      await userDoc.save();
    } else {
      boardDoc = await BoardModel.create({ name: trimmedBoardName, columns, group: false });
      //  board's objectid added only to the signed-in user's boards array
      userDoc.boards = [...userDoc.boards, boardDoc._id];
      await userDoc.save();
    };
    
    res.status(200).json(boardDoc);
  } catch(err) {
    next(err);
  };
});

/* update board */
router.post("/update-board", authenticate, async function(req, res, next) {
  const { name, boardId, columns } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    boardDoc.name = name;

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

    await boardDoc.save();
    res.status(200).json(boardDoc);
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
    // delete the board itself
    await BoardModel.deleteOne({ _id: boardId });

    // update the user's board array
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    const updatedBoardArr = userDoc.boards.filter(id => {
      return (id.toString() !== boardId);
    });
    userDoc.boards = updatedBoardArr;
    await userDoc.save();
    res.status(200).json(userDoc);
  } catch(err) {
    next(err);
  };
});

/* create task */
router.post("/create-task", authenticate, async function(req, res, next) {
  // subtasks should be formatted already as an array of objects 
  const { boardId, columnId, task, desc, subtasks } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    const columnDoc = boardDoc.columns.id(columnId);
    columnDoc.tasks = [
      ...columnDoc.tasks,
      { task, desc, subtasks }
    ];
    await boardDoc.save();
    res.status(200).json(boardDoc);
  } catch(err) {
    next(err);
  };
});

/* update task - just for updating subtask status and changing the column */
router.post("/update-task", authenticate, async function(req, res, next) {
  const { boardId, colId, taskId, taskOrder, updatedSubtasks = undefined, updatedTaskOrder = undefined, updatedColId } = req.body;
  console.log(req.body);

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    // can string multiple find commands to access deeply nested subdocs
    const curTaskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

    if (updatedSubtasks) {
      updatedSubtasks.forEach(async (updatedSubtask) => {
        const subtaskDoc = await curTaskDoc.subtasks.id(updatedSubtask.id);
        if (subtaskDoc) subtaskDoc.status = updatedSubtask.status;
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
  const { boardId, colId, taskId, task, desc, updatedSubtasks, updatedColId } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    const taskDoc = await boardDoc.columns.id(colId).tasks.id(taskId);

    taskDoc.task = task;
    taskDoc.desc = desc;

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
  } catch(err) {
    next(err);
  };
});

/* delete task */
router.delete("/delete-task/:boardId/:columnId/:taskId", authenticate, async function (req, res, next) {
   const { boardId, columnId, taskId } = req.params;

   try {
     const boardDoc = await BoardModel.findOne({ _id: boardId });
     const columnDoc = await boardDoc.columns.id(columnId);
     columnDoc.tasks = columnDoc.tasks.filter(task => {
      return (task._id.toString() !== taskId);
     });

     await boardDoc.save();
     res.status(200).json(boardDoc);
    } catch(err) {
     next(err);
  };
});

/* pull users for possible contributors */
router.get("/search/:searchTerm", authenticate, async function(req, res, next) {
  const searchTerm = req.params.searchTerm.trim().toLowerCase();

  try {
    if (searchTerm.includes("@")) {
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

router.post("/add-contributors", authenticate, async function(req, res, next) {
  // if the board has not been made yet...
  // what we're working on right now, coming from the create board modal


  // vs. if the board has already been made
  // edit board modal
});

module.exports = router;
