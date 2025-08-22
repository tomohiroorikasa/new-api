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

const templatePath = path.join(import.meta.dirname, '../../../../templates', 'html', 'info.html')
let template = null

const domain = process.env.DOMAIN

let baseUrl
if (domain.includes('localhost')) {
  baseUrl = 'http://localhost:3000'
} else {
  baseUrl = `https://${domain}`
}

const GenerateStaticHTML = (config, info) => {
  if (!template) {
   template = fs.readFileSync(templatePath, 'utf-8')
  }

  const title = `${info.title} on ${config.name}`
  const description = StripHtmlTags(info.description).slice(0, 160)
  const url = `${baseUrl}/info/${info._id}`

  // 画像がある場合のOG画像URL
  const imageUrl = info.Files && info.Files.length > 0
    ? `${baseUrl}/file/${info.Files[0]._id}` // baseUrlを使用
    : ''

  let linksText = ''
  if (info.links && info.links.length > 0) {
    for (const link of info.links) {
      let linkText = `<a href="${link.url}">${link.label}</a>`
      linksText += linkText + '\n'
    }
  }
console.log(linksText)

  const vars = {
    title: title,
    description: description,
    url: url,
    siteName: config.name,
    domain: config.domain,
    info: info,
    // links: linksText,
    ogImage: imageUrl || '',
    twitterCard: imageUrl ? 'summary_large_image' : 'summary'
  }

  const _template =  ReplaceText(template, vars)

  return ReplaceHtml(_template, { links: linksText })
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let html = ''
    try {
      const info = await fastify.mongo.db
        .collection('Infos')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!info) {
        throw new Error('Not Found Info')
      }

      const config = await GetConfig(fastify)

      if (info.postedBy) {
        const user = await fastify.mongo.db
          .collection('Users')
          .findOne({
            _id: info.postedBy,
            // deleted: { $ne: true }
          })

        info.PostedBy = {
          _id: info.postedBy,
        }

        if (user) {
          if (user.deleted) {
            info.PostedBy.id = user.id
            info.PostedBy.deleted = true

            info.deleted = true
            delete ret.text
            delete ret.files
          } else {
            info.PostedBy = FilterData(user, userSchema)
          }
        }
      }

      if (info.files && !info.deleted) {
        const filesAggregate = [
          {
            $match: {
              infoId: info._id,
              _id: {
                $in: info.files
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

        info.Files = await fastify.mongo.db
          .collection('Files')
          .aggregate(filesAggregate)
          .toArray()

        delete info.files
      }

      html = GenerateStaticHTML(config, info)

      reply.type('text/html')

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return html
  })
}
