const mongoose = require("mongoose");

const SubTaskSchema = new mongoose.Schema({
    subtask: {
        type: String,
        required: [true, "Please enter a title for this subtask."],
        minLength: [1, "Minimum title length is 1 character."],
        maxLength: [50, "Maximum title length is 50 characters."],
        trim: true,
    },
    status: {
        type: Boolean,
        default: false,
    },
});

const TaskSchema = new mongoose.Schema({
    task: {
        type: String,
        required: [true, "Please enter a title for this task."],
        minLength: [1, "Minimum title length is 1 character."],
        maxLength: [50, "Maximum title length is 50 characters."],
        trim: true,
    },
    desc: {
        type: String,
        maxLength: [200, "Maximum description length is 200 characters."],
        trim: true,
    },
    subtasks: [SubTaskSchema],
});

const BoardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter a name for this board."],
        trim: true,
    },
    columns: [TaskSchema],
});

module.exports = mongoose.model("board", BoardSchema);