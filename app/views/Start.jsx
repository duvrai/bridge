import React from 'react'

import { ProjectBrowser } from '../components/ProjectBrowser'

export const Start = () => {
  if (!window.APP?.serverProjects) {
    return (
      <div>
        <h1>Welcome</h1>
        <a href='/new'>New workspace</a>
      </div>
    )
  }

  return (
    <ProjectBrowser
      onOpenProject={name => {
        window.location.assign(`/projects/${encodeURIComponent(name)}`)
      }}
    />
  )
}
