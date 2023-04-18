var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");

const UserModel = require("../models/UserModel");
const BoardModel = require("../models/BoardModel");

/* authentication middleware */
async function authenticate(req, res, next) {
  const token = req.cookies.jwt;

  try {
    if (token) {
      const decodedToken = await jwt.verify(token, process.env.JWT_SECRET);
      res.locals.userId = decodedToken.id;
      next();
    } else {
      res.locals.user = null;
      throw new Error("Please log in.");
    }
  } catch(err) {
    res.locals.user = null;
    res.status(404).send(err.message);
  };
}

/* read board/tasks */


/* create board - receives name and columns */
router.post("/create-board", authenticate, async function(req, res, next) {
  const { name, columns } = req.body;
  const boardName = name.trim().toLowerCase();
  
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });

    // populates the board info in the user doc so that board names can be compared
    const populatedUserDoc = await userDoc.populate("boards");
    populatedUserDoc.boards.forEach(board => {
      if (board.name.toLowerCase() === boardName) {
        throw new Error("Cannot create a board with the same name.");
      };
    });

    // since error was not thrown, a new board is created and its objectid added to the user doc's boards array
    const boardDoc = await BoardModel.create({ name: boardName, columns });
    userDoc.boards = [...userDoc.boards, boardDoc._id];
    await userDoc.save();
    res.status(200).send("Board saved!");
  } catch(err) {
    res.status(404).send(err.message);
  };
});

/* update board */

/* delete board */
router.delete("/delete-board", authenticate, async function(req, res, next) {
  const { name } = req.body;
  // may not need to normalize because it should not be user input
  const boardName = name.trim().toLowerCase();

  try {
    // delete the board itself
    await BoardModel.deleteOne({ name: boardName });

    // update the user's board array
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });
    const populatedUserDoc = await userDoc.populate("boards");
    const updatedBoardArr = populatedUserDoc.boards.filter(board => {
      return (board.name.toLowerCase() !== boardName);
    });
    
    if (updatedBoardArr.length < populatedUserDoc.boards.length) {
      userDoc.boards = updatedBoardArr;
      await userDoc.save();
      res.status(200).send("Board successfully deleted.");
    } else {
      throw new Error("Something went wrong--the number of boards has not changed.");
    };
  } catch(err) {
    res.status(404).send(err.message);
  };
});


/* create task */

/* update task */

/* delete task */



module.exports = router;
