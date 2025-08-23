import fs from 'fs'
import path from 'path'

// import { IsBoolean, IsNumber, Clone, FilterData, GetConfig, CurrentUser, AdUsers, Followers, Members, ValidateData, RecursiveEach,  AutoTags, ExtractLink, ExistsFile, SaveFile, LoadFile } from "../../../lib.mjs"

import { FilterData, GetConfig, StripHtmlTags, ReplaceText, ReplaceHtml } from "../../../../lib.mjs"

/*
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'

import reallyRelaxedJson from 'really-relaxed-json'
const { toJson } = reallyRelaxedJson

import Autolinker from 'autolinker'

const execFileAsync = promisify(execFile)

const TEMP_DIR = process.env.TEMP_DIR

dayjs.extend(utc)
dayjs.locale('ja')
dayjs.extend(relativeTime)
*/

const userSchema = {
  id: 1,
  handle: 1,
  external: 1,
  domain: 1,
  actorUrl: 1,
  bgColor: 1,
  bgId: 1,
  avatarColor: 1,
  avatarId: 1,
  deleted: 1
}

const templatePath = path.join(import.meta.dirname, '../../../../templates', 'html', 'magazine.html')
let template = null

const domain = process.env.DOMAIN

let baseUrl
if (domain.includes('localhost')) {
  baseUrl = 'http://localhost:3000'
} else {
  baseUrl = `https://${domain}`
}

const GenerateStaticHTML = (config, magazine) => {
  if (!template) {
   template = fs.readFileSync(templatePath, 'utf-8')
  }

  const title = `${magazine.title} on ${config.name}`
  const description = StripHtmlTags(magazine.description).slice(0, 160)
  const url = `${baseUrl}/magazine/${magazine._id}?thumbnail`

  // 画像がある場合のOG画像URL
  const imageUrl = magazine.Files && magazine.Files.length > 0
    ? `${baseUrl}/file/${magazine.Files[0]._id}` // baseUrlを使用
    : ''

  const vars = {
    title: title,
    description: description,
    url: url,
    siteName: config.name,
    domain: config.domain,
    magazine: magazine,
    ogImage: imageUrl || '',
    twitterCard: imageUrl ? 'summary_large_image' : 'summary'
  }

  return ReplaceText(template, vars)
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let html = ''
    try {
      const magazine = await fastify.mongo.db
        .collection('Magazines')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!magazine) {
        throw new Error('Not Found Magazine')
      }

      const config = await GetConfig(fastify)

      if (magazine.postedBy) {
        const user = await fastify.mongo.db
          .collection('Users')
          .findOne({
            _id: magazine.postedBy,
            // deleted: { $ne: true }
          })

        magazine.PostedBy = {
          _id: magazine.postedBy,
        }

        if (user) {
          if (user.deleted) {
            magazine.PostedBy.id = user.id
            magazine.PostedBy.deleted = true

            magazine.deleted = true
            delete ret.text
            delete ret.files
          } else {
            magazine.PostedBy = FilterData(user, userSchema)
          }
        }
      }

      if (magazine.files && !magazine.deleted) {
        const filesAggregate = [
          {
            $match: {
              magazineId: magazine._id,
              _id: {
                $in: magazine.files
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

        magazine.Files = await fastify.mongo.db
          .collection('Files')
          .aggregate(filesAggregate)
          .toArray()

        delete magazine.files
      }

      html = GenerateStaticHTML(config, magazine)

      reply.type('text/html')

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return html
  })
}
