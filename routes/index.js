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


/* create board */
router.post("/create-board", authenticate, async function(req, res, next) {
  const { name, columns } = req.body;
  
  try {
    const userDoc = await UserModel.findOne({ _id: res.locals.userId });

    // populates the board info in the user doc so that board names can be compared
    const populatedUserDoc = await userDoc.populate("boards");
    populatedUserDoc.boards.forEach(board => {
      console.log(board);
      if (board.name.toLowerCase() === name.toLowerCase()) {
        throw new Error("Cannot create a board with the same name.");
      };
    });

    // since error was not thrown, a new board is created and its objectid added to the user doc's boards array
    const boardDoc = await BoardModel.create({ name, columns });
    userDoc.boards = [...userDoc.boards, boardDoc._id];
    await userDoc.save();
    res.status(200).send("Board saved!");
  } catch(err) {
    res.status(404).send(err.message);
  };
});

/* update board */

/* delete board */


/* create task */

/* update task */

/* delete task */



module.exports = router;
