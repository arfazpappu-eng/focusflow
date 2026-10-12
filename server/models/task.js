const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },

  deadline: {
    type: String,
    default: 'No deadline',
  },

  completed: {
    type: Boolean,
    default: false,
  },

  // Each new task belongs to one user account.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
})

const Task = mongoose.model('Task', taskSchema)

module.exports = Task