import { useEffect, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import './App.css'

const API = 'https://focusflow-rho-two.vercel.app/api'

// Adds the login token to every request
const authHeaders = (extra = {}) => {
  const token = localStorage.getItem('focusflow_token')
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const jsonHeaders = () => authHeaders({ 'Content-Type': 'application/json' })

function App() {
  const [message, setMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('tasks')

  // =========================
  // AUTHENTICATION
  // =========================

  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(localStorage.getItem('focusflow_token'))
  )
  const [authMode, setAuthMode] = useState('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthLoading(true)

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      localStorage.setItem('focusflow_token', data.token)
      localStorage.setItem('focusflow_user', JSON.stringify(data.user))
      setIsAuthenticated(true)
      setAuthPassword('')
      setAuthMessage('')
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthLoading(true)

    try {
      const response = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      setAuthMode('login')
      setAuthPassword('')
      setAuthMessage('Account created successfully. Please log in.')
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('focusflow_token')
    localStorage.removeItem('focusflow_user')
    setIsAuthenticated(false)
    setAuthEmail('')
    setAuthPassword('')
    setAuthMessage('')

    // Clear the previous user's data
    setTasks([])
    setSchedules([])
    setSessions([])
    setGoogleAccessToken(null)
    setMessage('')
    setMenuOpen(false)
  }

  // =========================
  // GOOGLE CALENDAR
  // =========================

  const [googleAccessToken, setGoogleAccessToken] = useState(null)

  const loginWithGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: (tokenResponse) => {
      setGoogleAccessToken(tokenResponse.access_token)
      setMessage('Google Calendar connected successfully!')
    },
    onError: () => {
      setMessage('Google Calendar connection failed.')
    },
  })

  const addToGoogleCalendar = async (schedule) => {
    if (!googleAccessToken) {
      setMessage('Please connect Google Calendar first.')
      return
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: schedule.subject,
            description: schedule.classLink
              ? `Online class: ${schedule.classLink}`
              : 'FocusFlow scheduled activity',
            start: {
              dateTime: `${schedule.date}T${schedule.startTime}:00`,
              timeZone,
            },
            end: {
              dateTime: `${schedule.date}T${schedule.endTime}:00`,
              timeZone,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Google Calendar error:', errorData)

        // Token expired: ask the user to reconnect
        if (response.status === 401) {
          setGoogleAccessToken(null)
          setMessage('Google session expired. Please reconnect Google Calendar.')
          return
        }
        throw new Error('Failed to add event')
      }

      setMessage(`"${schedule.subject}" was added to Google Calendar!`)
    } catch (error) {
      console.error('Failed to add Google Calendar event:', error)
      setMessage('Could not add the schedule to Google Calendar.')
    }
  }

  // =========================
  // STATE: TASKS / SCHEDULES / SESSIONS
  // =========================

  const [tasks, setTasks] = useState([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskMessage, setTaskMessage] = useState('')

  const [schedules, setSchedules] = useState([])
  const [scheduleSubject, setScheduleSubject] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const [scheduleClassLink, setScheduleClassLink] = useState('')
  const [scheduleMessage, setScheduleMessage] = useState('')

  const [sessions, setSessions] = useState([])
  const [sessionSubject, setSessionSubject] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')

  // =========================
  // LOAD DATA (runs after login)
  // =========================

  useEffect(() => {
    if (!isAuthenticated) return

    const load = async (path, setter, label) => {
      try {
        const response = await fetch(`${API}/${path}`, {
          headers: authHeaders(),
        })
        if (!response.ok) {
          throw new Error(`Failed to load ${label}`)
        }
        const data = await response.json()
        setter(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error(`Failed to load ${label}:`, error)
      }
    }

    load('tasks', setTasks, 'tasks')
    load('schedules', setSchedules, 'schedules')
    load('study-sessions', setSessions, 'study sessions')
  }, [isAuthenticated])

  // =========================
  // NAVIGATION
  // =========================

  const goToTab = (tab) => {
    setActiveTab(tab)
    setMenuOpen(false)
  }

  const scrollToTasks = () => {
    setActiveTab('tasks')
    setTimeout(() => {
      document
        .getElementById('tasks')
        ?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  // =========================
  // TASK FUNCTIONS
  // =========================

  const saveTask = async () => {
    if (taskTitle.trim() === '') {
      setTaskMessage('Please enter a task name.')
      return
    }

    setTaskMessage('')

    try {
      if (editingTaskId !== null) {
        const task = tasks.find((t) => t._id === editingTaskId)

        if (!task) {
          setTaskMessage('Task not found.')
          return
        }

        const response = await fetch(`${API}/tasks/${editingTaskId}`, {
          method: 'PUT',
          headers: jsonHeaders(),
          body: JSON.stringify({
            title: taskTitle,
            deadline: taskDeadline || 'No deadline',
            completed: task.completed,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to update task')
        }

        const updatedTask = await response.json()
        setTasks((prev) =>
          prev.map((t) => (t._id === editingTaskId ? updatedTask : t))
        )
        setEditingTaskId(null)
      } else {
        const response = await fetch(`${API}/tasks`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            title: taskTitle,
            deadline: taskDeadline || 'No deadline',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create task')
        }

        const newTask = await response.json()
        setTasks((prev) => [...prev, newTask])
      }

      // Only clear the form when the request succeeded
      setTaskTitle('')
      setTaskDeadline('')
    } catch (error) {
      console.error('Failed to save task:', error)
      setTaskMessage('Could not save the task. Please try again.')
    }
  }

  const editTask = (task) => {
    setEditingTaskId(task._id)
    setTaskTitle(task.title)
    setTaskDeadline(task.deadline === 'No deadline' ? '' : task.deadline)
  }

  const cancelEdit = () => {
    setEditingTaskId(null)
    setTaskTitle('')
    setTaskDeadline('')
    setTaskMessage('')
  }

  const deleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete task')
      }

      setTasks((prev) => prev.filter((t) => t._id !== taskId))

      if (editingTaskId === taskId) {
        cancelEdit()
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
      setTaskMessage('Could not delete the task.')
    }
  }

  const completeTask = async (taskId) => {
    const task = tasks.find((t) => t._id === taskId)
    if (!task) return

    try {
      const response = await fetch(`${API}/tasks/${taskId}`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({
          title: task.title,
          deadline: task.deadline,
          completed: !task.completed,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update task')
      }

      const updatedTask = await response.json()
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updatedTask : t)))
    } catch (error) {
      console.error('Failed to complete task:', error)
      setTaskMessage('Could not update the task.')
    }
  }

  // =========================
  // SCHEDULE FUNCTIONS
  // =========================

  const addSchedule = async () => {
    if (
      scheduleSubject.trim() === '' ||
      scheduleDate === '' ||
      scheduleStart === '' ||
      scheduleEnd === ''
    ) {
      setScheduleMessage('Please complete all required schedule fields.')
      return
    }

    if (scheduleEnd <= scheduleStart) {
      setScheduleMessage('End time must be after the start time.')
      return
    }

    setScheduleMessage('')

    try {
      const response = await fetch(`${API}/schedules`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          subject: scheduleSubject,
          date: scheduleDate,
          startTime: scheduleStart,
          endTime: scheduleEnd,
          classLink: scheduleClassLink,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create schedule')
      }

      const newSchedule = await response.json()
      setSchedules((prev) => [...prev, newSchedule])

      setScheduleSubject('')
      setScheduleDate('')
      setScheduleStart('')
      setScheduleEnd('')
      setScheduleClassLink('')
    } catch (error) {
      console.error('Failed to save schedule:', error)
      setScheduleMessage('Could not save the schedule. Please try again.')
    }
  }

  const deleteSchedule = async (scheduleId) => {
    try {
      const response = await fetch(`${API}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete schedule')
      }

      setSchedules((prev) => prev.filter((s) => s._id !== scheduleId))
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      setScheduleMessage('Could not delete the schedule.')
    }
  }

  // =========================
  // STUDY SESSION FUNCTIONS
  // =========================

  const addSession = async () => {
    if (
      sessionSubject.trim() === '' ||
      sessionDate === '' ||
      sessionMinutes === ''
    ) {
      setSessionMessage('Please complete all study session fields.')
      return
    }

    setSessionMessage('')

    try {
      const response = await fetch(`${API}/study-sessions`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          subject: sessionSubject,
          date: sessionDate,
          minutes: Number(sessionMinutes),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create study session')
      }

      const newSession = await response.json()
      setSessions((prev) => [...prev, newSession])

      setSessionSubject('')
      setSessionDate('')
      setSessionMinutes('')
    } catch (error) {
      console.error('Failed to save study session:', error)
      setSessionMessage('Could not save the study session. Please try again.')
    }
  }

  const deleteSession = async (sessionId) => {
    try {
      const response = await fetch(`${API}/study-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete study session')
      }

      setSessions((prev) => prev.filter((s) => s._id !== sessionId))
    } catch (error) {
      console.error('Failed to delete study session:', error)
      setSessionMessage('Could not delete the study session.')
    }
  }

  // =========================
  // PRODUCTIVITY CALCULATIONS
  // =========================

  const totalMinutes = sessions.reduce(
    (total, session) => total + Number(session.minutes),
    0
  )
  const averageMinutes =
    sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const completedTasks = tasks.filter((task) => task.completed).length

  // =========================
  // AUTH PAGE
  // =========================

  if (!isAuthenticated) {
    return (
      <div
        className="auth-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="auth-card"
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '28px',
            borderRadius: '18px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <img
              src="/focusflow-logo.png"
              alt="FocusFlow logo"
              style={{
                width: '52px',
                height: '52px',
                objectFit: 'contain',
                marginBottom: '8px',
              }}
            />
            <h1 style={{ margin: '0 0 6px', fontSize: '28px' }}>FocusFlow</h1>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {authMode === 'login'
                ? 'Welcome back. Log in to continue.'
                : 'Create your FocusFlow account.'}
            </p>
          </div>

          <form
            onSubmit={authMode === 'login' ? handleLogin : handleRegister}
            style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}
          >
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Full name"
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                required
                style={{ margin: 0 }}
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              required
              style={{ margin: 0 }}
            />

            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              minLength={6}
              required
              style={{ margin: 0 }}
            />

            {authMessage && (
              <p
                style={{
                  margin: '2px 0',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                {authMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{ marginTop: '3px', padding: '11px 16px' }}
            >
              {authLoading
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Log In'
                  : 'Create Account'}
            </button>
          </form>

          <div
            style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}
          >
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                setAuthMessage('')
              }}
              style={{
                padding: 0,
                margin: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {authMode === 'login' ? 'Create one' : 'Log in'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================
  // MAIN APP
  // =========================

  return (
    <div className="app">
      <header
        className="navbar"
        style={{ position: 'sticky', top: 0, zIndex: 1000 }}
      >
        <div
          className="brand"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <img
            src="/focusflow-logo.png"
            alt="FocusFlow logo"
            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
          />
          <h2>FocusFlow</h2>
        </div>

        <nav className={menuOpen ? 'mobile-menu-open' : ''}>
          <button
            type="button"
            className={activeTab === 'tasks' ? 'active' : ''}
            aria-current={activeTab === 'tasks' ? 'page' : undefined}
            onClick={() => goToTab('tasks')}
          >
            Tasks
          </button>

          <button
            type="button"
            className={activeTab === 'schedule' ? 'active' : ''}
            aria-current={activeTab === 'schedule' ? 'page' : undefined}
            onClick={() => goToTab('schedule')}
          >
            Schedule
          </button>

          <button
            type="button"
            className={activeTab === 'sessions' ? 'active' : ''}
            aria-current={activeTab === 'sessions' ? 'page' : undefined}
            onClick={() => goToTab('sessions')}
          >
            Study Sessions
          </button>

          <button
            type="button"
            onClick={() => {
              loginWithGoogle()
              setMenuOpen(false)
            }}
          >
            {googleAccessToken
              ? 'Google Calendar Connected'
              : 'Connect Google Calendar'}
          </button>

          <button type="button" onClick={handleLogout}>
            Log Out
          </button>
        </nav>

        <button
          type="button"
          className="hamburger-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="hero-section">
          <div className="hero-content">
            <p className="welcome">WELCOME TO FOCUSFLOW</p>

            <h1>
              Plan your study.
              <br />
              Stay focused.
            </h1>

            <p className="description">
              FocusFlow helps students organise tasks, manage deadlines, plan
              schedules and record study sessions in one simple place.
            </p>

            <div className="hero-buttons">
              <button
                type="button"
                onClick={() => setMessage('Welcome to FocusFlow!')}
              >
                Get Started
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={scrollToTasks}
              >
                View Tasks
              </button>
            </div>

            {message && <p className="welcome-message">{message}</p>}
          </div>
        </section>

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <section id="tasks" className="features-section">
            <h2>Manage your study tasks</h2>
            <p className="section-description">
              Add, edit, complete and delete your academic tasks.
            </p>

            <div className="task-form">
              <input
                type="text"
                placeholder="Enter task name"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />

              <input
                type="date"
                value={taskDeadline}
                onChange={(event) => setTaskDeadline(event.target.value)}
              />

              <button type="button" onClick={saveTask}>
                {editingTaskId !== null ? 'Update Task' : 'Add Task'}
              </button>
            </div>

            {taskMessage && <p className="welcome-message">{taskMessage}</p>}

            {editingTaskId !== null && (
              <button
                type="button"
                className="cancel-button"
                onClick={cancelEdit}
              >
                Cancel Edit
              </button>
            )}

            <div className="task-preview">
              {tasks.length === 0 ? (
                <p className="empty-message">No tasks added yet.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    className={`task-item ${task.completed ? 'completed' : ''}`}
                    key={task._id}
                  >
                    <div className="task-information">
                      <h3>{task.title}</h3>
                      <p>Deadline: {task.deadline}</p>
                    </div>

                    <div className="task-actions">
                      <span className="task-status">
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>

                      <button
                        type="button"
                        className="complete-button"
                        onClick={() => completeTask(task._id)}
                      >
                        {task.completed ? 'Undo' : 'Complete'}
                      </button>

                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => editTask(task)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteTask(task._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <section id="schedule" className="schedule-section">
            <h2>Plan your schedule</h2>
            <p className="section-description">
              Create a simple schedule for your study activities.
            </p>

            <div className="schedule-form">
              <input
                type="text"
                placeholder="Subject or activity"
                value={scheduleSubject}
                onChange={(event) => setScheduleSubject(event.target.value)}
              />

              <input
                type="date"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
              />

              <label>
                Start time
                <input
                  type="time"
                  value={scheduleStart}
                  onChange={(event) => setScheduleStart(event.target.value)}
                />
              </label>

              <label>
                End time
                <input
                  type="time"
                  value={scheduleEnd}
                  onChange={(event) => setScheduleEnd(event.target.value)}
                />
              </label>

              <input
                type="url"
                placeholder="Online class link (optional)"
                value={scheduleClassLink}
                onChange={(event) => setScheduleClassLink(event.target.value)}
              />

              <button type="button" onClick={addSchedule}>
                Add Schedule
              </button>
            </div>

            {scheduleMessage && (
              <p className="welcome-message">{scheduleMessage}</p>
            )}

            {/* Google Calendar feedback is shown here too, since the hero
                message is not visible on this tab */}
            {message && <p className="welcome-message">{message}</p>}

            <div className="schedule-list">
              {schedules.length === 0 ? (
                <p className="empty-message">No schedules added yet.</p>
              ) : (
                schedules.map((schedule) => (
                  <div className="schedule-item" key={schedule._id}>
                    <div className="schedule-information">
                      <h3>{schedule.subject}</h3>
                      <p>Date: {schedule.date}</p>
                      <p>
                        Time: {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>

                    <div
                      className="schedule-actions"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        marginTop: '12px',
                      }}
                    >
                      {schedule.classLink && (
                        <a
                          href={schedule.classLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button type="button">Join Class</button>
                        </a>
                      )}

                      {googleAccessToken && (
                        <button
                          type="button"
                          onClick={() => addToGoogleCalendar(schedule)}
                        >
                          Add to Google Calendar
                        </button>
                      )}

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteSchedule(schedule._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* STUDY SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <section id="sessions" className="session-section">
            <h2>Record your study sessions</h2>
            <p className="section-description">
              Record the time you spend studying to understand your
              productivity.
            </p>

            <div className="session-form">
              <input
                type="text"
                placeholder="Subject or activity"
                value={sessionSubject}
                onChange={(event) => setSessionSubject(event.target.value)}
              />

              <input
                type="date"
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
              />

              <input
                type="number"
                placeholder="Study time in minutes"
                min="1"
                value={sessionMinutes}
                onChange={(event) => setSessionMinutes(event.target.value)}
              />

              <button type="button" onClick={addSession}>
                Add Study Session
              </button>
            </div>

            {sessionMessage && (
              <p className="welcome-message">{sessionMessage}</p>
            )}

            <div className="session-list">
              {sessions.length === 0 ? (
                <p className="empty-message">No study sessions recorded yet.</p>
              ) : (
                sessions.map((session) => (
                  <div className="session-item" key={session._id}>
                    <div>
                      <h3>{session.subject}</h3>
                      <p>Date: {session.date}</p>
                      <p>Study time: {session.minutes} minutes</p>
                    </div>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => deleteSession(session._id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* PRODUCTIVITY SUMMARY (visible on every tab) */}
        <section className="summary-section">
          <h2>Your Study Summary</h2>

          <div className="summary-cards">
            <div className="summary-card">
              <h3>{sessions.length}</h3>
              <p>Study Sessions</p>
            </div>

            <div className="summary-card">
              <h3>{totalMinutes}</h3>
              <p>Total Minutes</p>
            </div>

            <div className="summary-card">
              <h3>{averageMinutes}</h3>
              <p>Average Minutes</p>
            </div>

            <div className="summary-card">
              <h3>
                {totalHours}h {remainingMinutes}m
              </h3>
              <p>Total Study Time</p>
            </div>

            <div className="summary-card">
              <h3>{completedTasks}</h3>
              <p>Completed Tasks</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
