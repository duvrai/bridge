import React from 'react'

import './style.css'

const WARNING = 'There is no login. Anyone on the network can open, change and delete projects.'

async function request (url, options) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      message = body.description || body.message || message
    } catch {
      // The response had no JSON body.
    }
    throw new Error(message)
  }
  if (response.status === 204) {
    return null
  }
  return response.json()
}

export function ProjectBrowser ({ currentName, onOpenProject, onDismiss, onCurrentDeleted }) {
  const [catalog, setCatalog] = React.useState(null)
  const [selected, setSelected] = React.useState(0)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const projects = catalog?.projects || []
  const current = projects[selected]

  async function reload (preferName) {
    const next = await request('/api/v1/projects')
    setCatalog(next)
    const preferred = preferName || currentName || next.lastName
    const index = next.projects.findIndex(project => project.name === preferred)
    setSelected(index >= 0 ? index : 0)
    return next
  }

  React.useEffect(() => {
    reload().catch(err => setError(err.message))
  }, [])

  function openProject (project) {
    if (!project || typeof onOpenProject !== 'function') {
      return
    }
    onOpenProject(project.name)
  }

  async function run (action) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  function onKeyDown (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected(index => Math.min(projects.length - 1, index + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected(index => Math.max(0, index - 1))
    }
    if (event.key === 'Enter' && current && event.target.tagName !== 'INPUT') {
      event.preventDefault()
      openProject(current)
    }
  }

  return (
    <div className='ProjectList' onKeyDown={onKeyDown}>
      <h1>Projects</h1>
      <p className='ProjectList-note'>
        Projects are stored on the server in {catalog?.directory || window.APP?.projectsDirectory}. {WARNING}
      </p>
      <ul className='ProjectList-items' role='listbox' aria-label='Projects'>
        {
          projects.map((project, index) => {
            const isCurrent = project.name === currentName
            return (
              <li key={project.name}>
                <button
                  type='button'
                  role='option'
                  aria-selected={index === selected}
                  className={`ProjectList-item ${index === selected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => setSelected(index)}
                  onDoubleClick={() => openProject(project)}
                >
                  <span>{project.name}{isCurrent ? ' · current' : ''}</span>
                  <span className='ProjectList-time'>{new Date(project.mtimeMs).toLocaleString()}</span>
                </button>
              </li>
            )
          })
        }
      </ul>
      <label className='ProjectList-field'>
        Name
        <input value={name} onChange={event => setName(event.target.value)} />
      </label>
      <div className='ProjectList-actions'>
        <button type='button' className='Button--primary ProjectList-open' disabled={!current} onClick={() => openProject(current)}>Open</button>
        <button type='button' className='Button' onClick={() => run(async () => {
          const nextName = name.trim()
          await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: nextName }) })
          openProject({ name: nextName })
        })}>New</button>
        <button type='button' className='Button' disabled={!current || !name.trim()} onClick={() => run(async () => {
          await request(`/api/v1/projects/${encodeURIComponent(current.name)}/duplicate`, { method: 'POST', body: JSON.stringify({ name }) })
          setName('')
          await reload(name.trim())
        })}>Duplicate</button>
        <button type='button' className='Button' disabled={!current || !name.trim()} onClick={() => run(async () => {
          const nextName = name.trim()
          await request(`/api/v1/projects/${encodeURIComponent(current.name)}/rename`, { method: 'POST', body: JSON.stringify({ name: nextName }) })
          setName('')
          await reload(nextName)
        })}>Rename</button>
        <button type='button' className='Button' disabled={!current} onClick={() => setConfirmDelete(true)}>Delete</button>
        {
          onDismiss &&
            <button type='button' className='Button--ghost ProjectList-cancel' onClick={onDismiss}>Cancel</button>
        }
      </div>
      {
        confirmDelete && current &&
          <div className='ProjectList-confirm'>
            <span>
              {current.name === currentName
                ? `Delete ${current.name}? This closes the open project.`
                : `Delete ${current.name}?`}
            </span>
            <button type='button' className='Button ProjectList-confirmDelete' onClick={() => run(async () => {
              const deletingCurrent = current.name === currentName
              await request(`/api/v1/projects/${encodeURIComponent(current.name)}`, { method: 'DELETE' })
              setConfirmDelete(false)
              if (deletingCurrent && onCurrentDeleted) {
                onCurrentDeleted()
                return
              }
              await reload()
            })}>Delete</button>
            <button type='button' className='Button--ghost' onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
      }
      {error ? <p className='ProjectList-error'>{error}</p> : null}
    </div>
  )
}
