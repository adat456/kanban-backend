var express = require("express");
var router = express.Router();
const bcrypt = require("bcryptjs");
const UserModel = require("../models/UserModel");

/* create a new user */

router.post("/sign-up", function(req, res, next) {
  const { firstName, lastName, username, password, email } = req.body;

  UserModel.create({ firstName, lastName, username, password, email })
    .then(doc => console.log(doc))
    .catch(err => {
      console.log(err.message);
      res.status(404).send(err.message);
    });
});

router.post("/log-in", async function(req, res, next) {
  const { username, password } = req.body;
  const lowercaseUsername = username.toLowerCase();

  try {
    const doc = await UserModel.findOne({ username: lowercaseUsername }, "password");
    if (doc) {
      const authStatus = await bcrypt.compare(password, doc.password);
      if (authStatus) {
        res.status(200).send(doc);
      } else {
        throw new Error("Passwords do not match.");
      };
    } else {
      throw new Error("Unable to find a matching username.")
    };
  } catch(err) {
    res.status(404).send(err.message);
  };
});

module.exports = router;
