// SPDX-FileCopyrightText: 2026 duvrai
//
// SPDX-License-Identifier: MIT

const express = require('express')

const serverProjects = require('../serverProjects')

const router = express.Router()
router.use(express.json())

router.get('/', (req, res, next) => {
  try {
    res.json(serverProjects.list())
  } catch (err) {
    next(err)
  }
})

router.post('/', (req, res, next) => {
  try {
    res.status(201).json(serverProjects.create(req.body?.name))
  } catch (err) {
    next(err)
  }
})

router.post('/:name/duplicate', (req, res, next) => {
  try {
    res.status(201).json(serverProjects.duplicate(req.params.name, req.body?.name))
  } catch (err) {
    next(err)
  }
})

router.post('/:name/rename', (req, res, next) => {
  try {
    res.json(serverProjects.rename(req.params.name, req.body?.name))
  } catch (err) {
    next(err)
  }
})

router.delete('/:name', (req, res, next) => {
  try {
    serverProjects.remove(req.params.name)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = router
