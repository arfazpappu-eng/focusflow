const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  deadline: {
    type: String,
    default: 'No deadline',
  },

  completed: {
    type: Boolean,
    default: false,
  },
})

const Task = mongoose.model('Task', taskSchema)

module.exports = Task
