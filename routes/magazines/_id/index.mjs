import * as crypto from 'node:crypto'

import urlJoin from 'url-join'

import path from 'path'

import { writeFile, unlink } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'

// import { promisify } from 'util'
// import { execFile } from 'child_process'

// import sharp from "sharp"

import { IsBoolean, IsNumber, Clone, FilterData, GetConfig, CurrentUser, ValidateData, RecursiveEach, ExistsFile, SaveFile, LoadFile } from "../../../lib.mjs"

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'

import reallyRelaxedJson from 'really-relaxed-json'
const { toJson } = reallyRelaxedJson

import Autolinker from 'autolinker'

// const execFileAsync = promisify(execFile)

const TEMP_DIR = process.env.TEMP_DIR

dayjs.extend(utc)
dayjs.locale('ja')
dayjs.extend(relativeTime)

const schema = {
  draft: 1,
  type: 1,
  title: 1,
  description: 1,
  files: 1
}

const userSchema = {
  id: 1,
  handle: 1,
  bgColor: 1,
  bgId: 1,
  avatarColor: 1,
  avatarId: 1,
  deleted: 1
}

const patchRules = {
  draft: {
    isBoolean: true
  },
  type: {},
  title: {
    // required: true,
    maxLength: 400,
  },
  description: {
    // required: true,
    maxLength: 5000,
    // isHTML: true
  },
  force: {
    isBoolean: true
  },
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let ret = {}

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      ret._id = req.params.id

      let magazine = await fastify.mongo.db
        .collection('Magazines')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          // deleted: { $ne: true }
        })
      if (!magazine) {
        throw new Error('Not Found Magazine')
      }

      if (magazine.deleted) {
        ret.deleted = true
      } else if (!email && magazine.draft) {
        ret.draft = true
      } else {
        await fastify.mongo.db
          .collection('Magazines')
          .updateOne({
            _id: magazine._id,
          }, {
            $inc: {
              viewsCount: 1
            }
          })

        ret = FilterData(magazine, schema)
      }

      if (magazine.postedBy) {
        const user = await fastify.mongo.db
          .collection('Users')
          .findOne({
            _id: magazine.postedBy,
            // deleted: { $ne: true }
          })

        ret.PostedBy = {
          _id: magazine.postedBy,
        }

        if (user) {
          if (user.deleted) {
            ret.PostedBy.id = user.id
            ret.PostedBy.deleted = true

            ret.deleted = true
            delete ret.text
            delete ret.files
          } else {
            ret.PostedBy = FilterData(user, userSchema)

            if (currentUser) {
              ret.PostedBy.active = user.joined && dayjs().diff(user.latestJoinedAt, 'second') < 300
            }
          }
        }
      }

      if (ret.files) {
        const filesAggregate = [
          {
            $match: {
              magazineId: ret._id,
              _id: {
                $in: ret.files
              },
              deleted: { $ne: true }
            }
          }, {
            $project: {
              _id: 1,
              thumbnailId: 1,
              filename: 1,
              mimetype: 1,
              extension: 1,
            }
          }, {
            $sort: {
              postedAt: 1
            }
          }
        ]

        ret.Files = await fastify.mongo.db
          .collection('Files')
          .aggregate(filesAggregate)
          .toArray()

        delete ret.files
      }
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return ret
  })
}
