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
      throw new Error("Please log in.");
    }
  } catch(err) {
    res.locals.userId = null;
    res.status(404).json(err.message);
  };
}

// only read-board should receive the board name, because it is pulling the board id for future routes

/* read board/tasks */
router.get("/read-board/:name", authenticate, async function(req, res, next) {
  let boardName;
  // accepts either board ID or board name (which is converted from hyphenated to spaced)
  if (isNumeric(req.params.name)) {
    boardName = req.params.name;
  } else {
    boardName = req.params.name.trim().toLowerCase().split("-").join(" ");
  }

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
    res.status(404).json(err.message);
  }
});

/* create board - receives name and columns */
router.post("/create-board", authenticate, async function(req, res, next) {
  const { name, columns } = req.body;
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

    // since error was not thrown, a new board is created and its objectid added to the user doc's boards array
    const boardDoc = await BoardModel.create({ name: trimmedBoardName, columns });
    userDoc.boards = [...userDoc.boards, boardDoc._id];
    await userDoc.save();
    res.status(200).json(boardDoc);
  } catch(err) {
    res.status(404).json(err.message);
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
    columns.forEach(col => {
      // updating existing column if there is an ID
      if (col.id && col.name) {
        existingColumns.forEach(existingCol => {
          if (col.id === existingCol._id.toString()) {
            existingCol.name = col.name;
          };
        });
      };

      // removing existing column if there is an ID but an empty string
      if (col.id && !col.name) {
        existingColumns = existingColumns.filter(existingCol => (col.id !== existingCol._id.toString()));
      };

      // adding new column if they don't have an ID and the name string is not empty
      if (!col.id && col.name) {
        newColumns.push({ name: col.name, order: col.order });
      };
    });
    boardDoc.columns = [...existingColumns, ...newColumns];

    await boardDoc.save();
    res.status(200).json(boardDoc);
  } catch(err) {
    res.status(404).json(err.message);
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
    res.status(404).json(err.message);
  };
});

/* create task */
router.post("/create-task", authenticate, async function(req, res, next) {
  // subtasks should be formatted already as an array of objects 
  const { boardId, columnId, task, order, desc, subtasks } = req.body;

  try {
    const boardDoc = await BoardModel.findOne({ _id: boardId });
    const columnDoc = boardDoc.columns.id(columnId);
    columnDoc.tasks = [
      ...columnDoc.tasks,
      { task, order, desc, subtasks }
    ];
    await boardDoc.save();
    res.status(200).json(boardDoc);
  } catch(err) {
    res.status(404).json(err.message);
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
    res.status(404).json(err.message);
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
      // updating existing subtask if there is an ID
      if (subtask.id && subtask.subtask) {
        existingSubtasks.forEach(existingSubtask => {
          if (subtask.id === existingSubtask._id.toString()) {
            existingSubtask.subtask = subtask.subtask;
          };
        });
      };

      // removing existing column if there is an ID but an empty string
      if (subtask.id && !subtask.subtask) {
        existingSubtasks = existingSubtasks.filter(existingSubtask => (subtask.id !== existingSubtask._id.toString()));
      };

      // adding new column if they don't have an ID and the name string is not empty
      if (!subtask.id && subtask.subtask) {
        newSubtasks.push({ subtask: subtask.subtask, status: false });
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
    res.status(404).json(err.message);
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
     res.status(404).json(err.message);
  };
});

module.exports = router;
