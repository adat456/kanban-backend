require("dotenv").config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");


var app = express();

// setting up database connection
mongoose.set("strictQuery", false);
main().catch(err => console.log(err));
async function main() {
  await mongoose.connect(process.env.MONGOOSE_KEY);
  console.log("Connected to DB");
};

app.use(cors({credentials: true, origin: true}));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// allows Express to serve static React build files
app.use(express.static(path.join(__dirname, "client/dist")));

// added
const whitelist = ['http://localhost:3100', 'http://localhost:5173', 'https://https://enigmatic-plains-42167.herokuapp.com']
const corsOptions = {
  origin: function (origin, callback) {
    console.log("** Origin of request " + origin)
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      console.log("Origin acceptable");
      callback(null, true);
    } else {
      console.log("Origin rejected");
      callback(new Error('Not allowed by CORS'));
    };
  },
};
app.use(cors(corsOptions));

// first the API endpoints that send data
app.use("/", indexRouter);
app.use("/users", usersRouter);
// then the catch-all for any non-matching request, sends React's build index.html file
app.get("*", function(req, res) {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

// error handlers
function errorLogger(err, req, res, next) {
  // err.message pulls the actual error message, so that client receives a text statement instead of an empty object
  console.log(`Error: ${err.message}`);
  next(err);
};
function errorResponder(err, req, res, next) {
  const status = err.status || 404;
  res.status(status).json(err.message);
};
app.use(errorLogger);
app.use(errorResponder);

// invalid route handler (not an error handler)
// if client makes a fetch request to a route that does not exist
function invalidRoute(req, res, next) {
  res.status(404).send("Request made to invalid route.");
};
app.use(invalidRoute);

module.exports = app;
