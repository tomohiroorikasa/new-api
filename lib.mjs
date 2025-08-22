import fs from 'fs'
import path from 'path'

import * as crypto from 'node:crypto'

import axios from 'axios'

import urlJoin from 'url-join'

import { ObjectId } from '@fastify/mongodb'

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"

import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

// import { curly } from 'node-libcurl'

import { writeFile, unlink } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'

import { promisify } from 'util'
import { execFile } from 'child_process'

// import sharp from 'sharp'

import { parse } from 'parse5'
import { fromParse5 } from 'hast-util-from-parse5'
import { toHtml } from 'hast-util-to-html'
// import { toDom } from 'hast-util-to-dom'
import { /*matches, select,*/ selectAll } from 'hast-util-select'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

// import generator from 'generate-password'

import validator from 'validator'

import sanitizeHtml from 'sanitize-html'

import cloneDeep from 'clone-deep'

import Autolinker from 'autolinker'

import dotenv from 'dotenv'

import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'

import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables'

import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'

dotenv.config()

const snsConfig = {
  region: process.env.AWS_SNS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY
  }
}
const snsClient = new SNSClient(snsConfig)

let s3Config

/*
import { ChatOpenAI } from '@langchain/openai'

export const CommonLLM = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  temperature: 0,
  maxTokens: undefined,
  timeout: undefined,
  maxRetries: 2,
  apiKey: process.env.OPENAI_API_KEY,
})
*/

if (process.env.AWS_S3_ACCESS_KEY_ID) {
  s3Config = {
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY
    }
  }
} else {
  s3Config = {
    region: process.env.AWS_S3_REGION
  }
}

const s3client = new S3Client(s3Config)

const execFileAsync = promisify(execFile)

dayjs.extend(utc)
dayjs.locale('ja')

let config

let defaultConfig = {
  organizer: '',
  name: '',
  description: '',
  privacypolicy: '',
  termsofuse: '',
  contractType: 'trial',
  maxUsers: 10
}

defaultConfig.domain = process.env.DOMAIN
defaultConfig.subdomain = process.env.SUBDOMAIN

const loadTemplateText = async (data, field) => {
  defaultConfig[field] = ''
  const templatePathName = path.join(import.meta.dirname, './templates', field + '.txt')
  if (fs.existsSync(templatePathName)) {
    defaultConfig[field] = await fs.readFileSync(templatePathName, 'utf-8')
  }
}

const initializeText = async () => {
  await loadTemplateText(defaultConfig, 'organizer')
  await loadTemplateText(defaultConfig, 'name')
  await loadTemplateText(defaultConfig, 'description')
  await loadTemplateText(defaultConfig, 'privacypolicy')
  await loadTemplateText(defaultConfig, 'termsofuse')
}
initializeText()

export const GetConfig = async (fastify) => {
  if (!config) {
    let res = await fastify.mongo.db.collection('Config').findOne({})

    if (res) {
      config = FilterData(res, {
        subdomain: 1,
        domain: 1,
        organizer: 1,
        name: 1,
        description: 1,
        privacypolicy: 1,
        termsofuse: 1,
        isOpen: 1,
        useTeam: 1,
        useDM: 1,
        useSignup: 1,
        useInvite: 1,
        admins: 1,
        contractType: 1,
        useAI: 1,
        useAssist: 1,
        useModerator: 1,
        useQuestor: 1,
        useActivitypub: 1,
        maxUsers: 1
      })
    } else {
      config = {}
    }

    await fixConfig(fastify)
  }

  return config
}

const fixConfig = async (fastify) => {
  if (config.domain) {
    config.url = 'https://' + config.domain
  } else if (config.subdomain) {
    config.url = 'https://' + config.subdomain + '.ecomyu.net'
    config.domain = config.subdomain + '.ecomyu.net'
  }

  if (!config.organizer) {
    config.organizer = defaultConfig.organizer
  }
  if (!config.name) {
    config.name = defaultConfig.name
  }
  if (!config.description) {
    config.description = defaultConfig.description
  }
  if (!config.organizer) {
    config.organizer = defaultConfig.organizer
  }
  if (!config.privacypolicy) {
    config.privacypolicy = defaultConfig.privacypolicy
  }
  if (!config.termsofuse) {
    config.termsofuse = defaultConfig.termsofuse
  }

  if (config.isOpen === undefined) {
    config.isOpen = false
  }

  if (config.useSignup === undefined) {
    config.useSignup = true
  }
  if (config.useInvite === undefined) {
    config.useInvite = true
  }

  if (!config.contractType) {
    config.contractType = 'trial'
  }
  if (config.useAssist === undefined) {
    config.useAssist = false
  }
  if (config.useModerator === undefined) {
    config.useModerator = false
  }
  if (config.useQuestor === undefined) {
    config.useQuestor = false
  }
  if (config.useActivitypub === undefined) {
    config.useActivitypub = false
  }

  config.useX = false
  if (process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET) {
    config.useX = true
  }

  if (!config.maxUsers) {
    config.maxUsers = 10
  }


  if (process.env.OPENAI_API_KEY) {
    config.useAI = true
  } else {
    config.useAI = false

    config.useAssist = false
    config.useModerator = false
    config.useQuestor = false
  }

  if (config.admins) {
    config.Admins = []
    if (Array.isArray(config.admins) && config.admins.length > 0) {
      for (const adminEmail of config.admins) {
        const user = await fastify.mongo.db
          .collection('Users')
          .findOne({
            email: adminEmail,
            external: { $exists: false },
            deleted: { $ne: true }
          })
        if (user) {
          config.Admins.push({
            _id: user._id,
            id: user.id,
            // description
            // url
            handle: user.handle,
            bgColor: user.bgColor ? user.bgColor : null,
            bgId: user.bgId ? user.bgId : null,
            avatarColor: user.avatarColor ? user.avatarColor : null,
            avatarId: user.avatarId ? user.avatarId : null,
            // xid
            // latestJoinedA
          })
        }
      }
    }
    delete config.admins
  }
}

export const SetConfig = async (fastify, obj) => {
  if (obj) {
    config = Clone(obj)

    await fixConfig(fastify)

    return true
  }
  return false
}

export const CurrentUser = async (fastify, email) => {
  const user = await fastify.mongo.db.collection('Users').findOne({
    email: email,
    external: { $exists: false },
    deleted: { $ne: true }
  })

  return user
}

export const IsAdmin = async (fastify, user) => {
  await GetConfig(fastify)

  if (config && config.Admins && config.Admins.length > 0) {
    const isAdmin = config.Admins.find((admin) => {
      return String(admin._id) === String(user._id)
    })
    if (isAdmin) {
      return true
    }
  }
  return false
}

export const AdUsers = async (fastify) => {
  let ret = []
  const adUsers = await fastify.mongo.db
    .collection('Users')
    .find({
      external: { $exists: false },
      isAd: true
    })
    .toArray()
  if (adUsers.length > 0) {
    for (let user of adUsers) {
      ret.push(user._id)
    }
  }
  return ret
}

export const BlockUsers = async (fastify, currentUser) => {
  let ret = []
  const blockingUsers = await fastify.mongo.db
    .collection('Blocks')
    .find({
      userId: currentUser._id
    })
    .toArray()
  if (blockingUsers.length > 0) {
    for (let user of blockingUsers) {
      ret.push(user.otherUserId)
    }
  }

  const blockedUsers = await fastify.mongo.db
    .collection('Blocks')
    .find({
      otherUserId: currentUser._id
    })
    .toArray()
  if (blockedUsers.length > 0) {
    for (let user of blockedUsers) {
      ret.push(user.userId)
    }
  }

  return ret
}

export const Followers = async (fastify, user) => {
  let ret = []
  const followers = await fastify.mongo.db
    .collection('Follows')
    .find({
      otherUserId: user._id,
    })
    .sort({
      followedAt: -1
    })
    .toArray()

  if (followers.length > 0) {
    for (let follow of followers) {
      ret.push(follow.userId)
    }
  }

  return ret
}

export const Admins = async (fastify) => {
  let ret = []

  const config = await GetConfig(fastify)

  if (config.Admins) {
    for (const adminUser of config.Admins) {
      ret.push(adminUser._id)
    }
  }

  return ret
}

export const Members = async (fastify, team) => {
  let ret = []

  const members = await fastify.mongo.db
    .collection('Members')
    .find({
      teamId: team._id,
      deleted: { $ne: true }
    })
    .toArray()

  if (members.length > 0) {
    for (let member of members) {
      ret.push(member.userId)
    }
  }

  return ret
}

export const Wait = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

export const IsBoolean = (value) => {
  return (typeof value === 'boolean')
}

export const IsNumber = (value) => {
  return ((typeof value === 'number') && (isFinite(value)))
}

export const ValidateData = (inputs, dataRules) => {
  const incorrects = []
  const data = {}

  for (const [fieldKey, fieldRules] of Object.entries(dataRules)) {
    if (!fieldRules) continue

    if (inputs[fieldKey] === undefined) continue
    let fieldValue = inputs[fieldKey]

    let incorrect = false
    for (let [rule, option] of Object.entries(fieldRules)) {
      rule = rule.toLowerCase()

      if (rule === 'required') {
        if (typeof fieldValue === 'boolean') {
          if (!fieldValue === true && !fieldValue === false) {
            incorrect = true
          }
        } else {
          if (validator.isEmpty(fieldValue)) {
            incorrect = true
          }
        }
      } else if (rule === 'isempty') {
        if (fieldValue && !validator.isEmpty(fieldValue)) {
          incorrect = true
        }
      } else if (rule === 'email') {
        if (fieldValue && !validator.isEmail(fieldValue)) {
          incorrect = true
        }
      } else if (rule === 'regex') {
        if (fieldValue && !String(fieldValue).match(option)) {
          incorrect = true
        }
      } else if (rule === 'isin') {
        if (fieldValue && option.indexOf(fieldValue) < 0) {
          incorrect = true
        }
      } else if (rule === 'minlength') {
        if (fieldValue && String(fieldValue).length < Number(option)) {
          incorrect = true
        }
      } else if (rule === 'maxlength') {
        if (fieldValue && String(fieldValue).length > Number(option)) {
          incorrect = true
        }
      } else if (rule === 'isdate') {
        if (fieldValue === '') {
        } else if (typeof fieldValue === 'date') {
        } else if (typeof fieldValue === 'string') {
          try {
            fieldValue = dayjs(fieldValue + ' 00:00').toDate()
          } catch (e) {
            incorrect = true
          }
        }
      } else if (rule === 'isurl') {
        if (fieldValue && !validator.isURL(fieldValue, { protocols: ['https', 'http'] })) {
          incorrect = true
        }
      } else if (rule === 'ishtml') {
        if (fieldValue) {
          let dirty = String(fieldValue).trim()
          let crean = sanitizeHtml(dirty, {
            allowedTags: [ 'b', 'strong', 'em', 'i', 'strike', 'u', 'a', 'p', 'h4', 'div', 'blockquote', 'pre', 'code', 'br', 'ul', 'ol', 'li' ],
            allowedAttributes: {
              'a': [ 'href' ],
              'div': [ 'style' ],
              'img': [ 'class', 'border', 'width', 'height', 'src', 'slt' ],
            },
            // allowedIframeHostnames: ['www.youtube.com']
          })
          if (dirty !== crean) {
            incorrect = true
          }
        }
      } else if (rule === 'isobjectid') {
        if (fieldValue === undefined) {
          incorrect = true
        } else {
          try {
            fieldValue = new ObjectId(fieldValue)
          } catch (e) {
            incorrect = true
          }
        }
      }
    }

    if (incorrect) {
      incorrects.push(`${fieldKey}`)
    } else {
      data[fieldKey] = fieldValue
    }
  }
  return [!(incorrects.length > 0), incorrects, data]
}

const autolinker = new Autolinker({
  hashtag: 'twitter'
})

export const AutoTags = (str) => {
  let obj = {}

  const linkedText = autolinker.link(str)
  const tagTexts = linkedText.match(/<a href="https:\/\/twitter.com\/hashtag\/\S+" target="_blank" rel="noopener noreferrer">\S+<\/a>/g)
  if (tagTexts && tagTexts.length > 0) {
    for (let tagText of tagTexts) {
      if (tagText.match(/<a href="https:\/\/twitter.com\/hashtag\/\S+" target="_blank" rel="noopener noreferrer">(\S+)<\/a>/)) {
        const tag = RegExp.$1
        obj[tag.substr(1)] = true
      }
    }
  }

  let arr = []
  for (const [tag, bool] of Object.entries(obj)) {
    arr.push(tag)
  }

  return arr
}

export const RecursiveEach = (hash, func) => {
  for (let key in hash) {
    if (typeof hash[key] == "object" && hash[key] !== null) {
      RecursiveEach(hash[key], func)
    } else {
      let ret = func(key, hash[key])
      if (ret) {
        hash[key] = ret
      }
    }
  }
}

export const RecursivePosts = async (fastify, _id, arr) => {
  const post = await fastify.mongo.db
    .collection('Posts')
    .findOne({
      _id: _id,
      // deleted: { $ne: true }
    })
  if (post && post.parentId) {
    arr.push(post.parentId)
    RecursivePosts(fastify, post.parentId, arr)
  }
}

export const Clone = (obj) => {
  return cloneDeep(obj)
}

export const Shuffle = (str) => {
  let arr = str.split('')
  let c = 0
  do {
    let r = Math.floor(Math.random() * arr.length)
    let char = arr[c]
    arr[c] = arr[r]
    arr[r] = char
    c++
  } while (c < arr.length)

  return arr.join('')
}

const commonFields = ['postedAt', 'postedBy', 'patchedAt', 'patchedBy', 'deleted', 'deletedAt', 'deletedBy']
export const FilterData = (data, schema) => {
  let ret = {}
  for (let [key, value] of Object.entries(data)) {
    if (key === '_id') {
      ret[key] = value
    } else if (Object.keys(schema).indexOf(key) >= 0) {
      ret[key] = value
    } else if (commonFields.indexOf(key) >= 0) {
      ret[key] = value
    }
  }
  return ret
}

export const ExtractChangedData = (newData, oldData) => {
  let data = {}

  for (let [key, value] of Object.entries(newData)) {
    if (key === '_id') { continue }
    if (!JSON.stringify(oldData[key])) {
      data[key] = value
    } else {
      switch (typeof value) {
        case 'string':
        case 'boolean':
        case 'number':
          if (oldData[key] !== value) {
            data[key] = value
          }
          break
        case 'object':
          if (JSON.stringify(oldData[key]) !== JSON.stringify(value)) {
            data[key] = value
          }
          break
        default:
          data[key] = value
      }
    }
  }

  return data
}

export const StripHtmlTags = (value) => {
  return String(value).replace(/(<([^>]+)>)/gi, "")
}

export const html2text = (html) => {
 if (!html) return ''

 return String(html)
   // 改行系タグを改行文字に変換
   .replace(/<br\s*\/?>/gi, '\n')
   .replace(/<\/p>/gi, '\n')
   .replace(/<\/div>/gi, '\n')
   .replace(/<\/h[1-6]>/gi, '\n')
   .replace(/<\/li>/gi, '\n')

   // リストアイテムに番号/記号を追加
   .replace(/<li[^>]*>/gi, '• ')

   // 段落開始に改行を追加（最初以外）
   .replace(/(?<!^)<p[^>]*>/gi, '\n')
   .replace(/<div[^>]*>/gi, '\n')
   .replace(/<h[1-6][^>]*>/gi, '\n')

   // その他のHTMLタグを削除
   .replace(/<[^>]+>/g, '')

   // HTMLエンティティをデコード
   .replace(/&nbsp;/g, ' ')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&amp;/g, '&')
   .replace(/&quot;/g, '"')

   // 連続する改行を整理
   .replace(/\n\s*\n\s*\n/g, '\n\n')
   .replace(/^\s+|\s+$/g, '')
}

export const EscapeRegex = (s) => {
  return String(s).replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export const EscapeHTML = (s) => {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

export const ReplaceText = (str, obj) => {
  let _str = str

  for (let key in obj) {
    let value = obj[key]

    if (key !== 'password') {
      value = StripHtmlTags(value)
    }

    let re = new RegExp(`%%${key}%%`, 'g')
    _str = _str.replace( re, value )
  }

  return _str
}

export const GenerateMessage = async (fastify, templateName, obj) => {
  let templatePathName, template, phone, message

  phone = '+81' + obj.phone,

  templatePathName = path.join(import.meta.dirname, './templates', 'messages', templateName + '.txt')
  if (fs.existsSync(templatePathName)) {
    template = fs.readFileSync(templatePathName, 'utf-8')
  }

  message = ReplaceText(template, obj).trim()

  try {
    const res = await snsClient.send(
      new PublishCommand({
        PhoneNumber: phone,
        Message: message,
      })
    )
  } catch (e) {
    console.log('GenerateMessage:', e)
  }
}

export const GenerateMail = async (fastify, templateName, obj) => {
  const mail = {
    template: templateName,
    from: obj.from,
    to: obj.to
  }

  if (obj.bcc) {
    mail.bcc = obj.bcc
  }

  mail.postedAt = new Date()

  let templatePathName, template, subject, body

  templatePathName = path.join(import.meta.dirname, './templates', 'emails', templateName + '.txt')
  if (fs.existsSync(templatePathName)) {
    template = fs.readFileSync(templatePathName, 'utf-8')

    subject = template.split('\n', 2)[0]
    mail.subject = ReplaceText(subject, obj)

    body = template.substring(subject.length + 1)
    mail.text = ReplaceText(body, obj)
  }

  templatePathName = path.join(import.meta.dirname, './templates', 'emails', templateName + '.html')
  if (fs.existsSync(templatePathName)) {
    template = fs.readFileSync(templatePathName, 'utf-8')

    if (!subject) {
      subject = template.split('\n', 2)[0]
      mail.subject = ReplaceText(subject, obj)
    }

    body = template.substring(subject.length + 1)
    mail.html = ReplaceText(body, obj)
  }

  await fastify.mongo.db.collection('Mails').insertOne(mail)
}

export const LoadFile = async (fileId) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileId
    })

    const res = await s3client.send(command)

    return res.Body ? res.Body.transformToByteArray() : null
  } catch (e) {
    console.log('LoadFile:', e)
  }
  return false
}

export const SaveFile = async (fileId, buf, contentType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileId,
      Body: buf,
      ContentType: contentType
    })

    await s3client.send(command)
  } catch (e) {
    console.log('SaveFile:', e)
  }
}

export const ExistsFile = async (fileId) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileId
    })

    const res = await s3client.send(command)

    return res.$metadata ? res.$metadata : null
  } catch (e) {
    console.log('ExistsFile:', e)
  }
  return false
}

export const DeleteFile = async (fileId) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileId
    })

    await s3client.send(command)
  } catch (e) {
    console.log('DeleteFile:', e)
  }
}

/*
export const ThumbnailFile = async (fastify, fileId, buf, contentType, size, params) => {
  const width = (size && size[0]) || 800
  const height = (size && size[1]) || 418

  let thumbnailId = null

  try {
    if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/gif' || contentType === 'image/heic' || contentType === 'image/webp') {
      await sharp(buf)
        .resize(width, height, { fit: 'cover' })
        .jpeg({
          quality: 75,
          // progressive: true
        })
        .toBuffer()
        .then(async (_buf) => {
          const inserted = await fastify.mongo.db
            .collection('Files')
            .insertOne({
              originId: fileId,
              filename: 'thumbnail.jpg',
              mimetype: 'image/jpeg',
              postedAt: new Date(),
              ...(params || {})
            })

          thumbnailId = inserted.insertedId

          await SaveFile(String(thumbnailId), _buf, 'image/jpeg')

          await fastify.mongo.db
            .collection('Files')
            .updateOne({
              _id: fileId,
            }, {
              $set: {
                thumbnailId: thumbnailId
              }
            })
        })
        .catch(async (e) => {
          console.log(e)
          throw e
        })
    } else if (contentType === 'video/quicktime' || contentType === 'video/mp4') {
      let videoExt = 'mov'
      if (contentType === 'video/mp4') {
        videoExt = 'mp4'
      }
      const videoPath = path.join(process.env.TEMP_DIR, String(fileId) + '.' + videoExt)
      const imagePath = path.join(process.env.TEMP_DIR, String(fileId) + '.jpg')

      await writeFile(videoPath, buf)

      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ])

      const duration = parseFloat(stdout.trim())

      let isOutputExists = existsSync(imagePath)
      if (isOutputExists) {
        await unlink(imagePath)
      }

      await execFileAsync('ffmpeg', [
        '-i', videoPath,
        '-ss', String(Math.round(duration / 2)),
        '-vframes', '1',
        '-q:v', 2,
        imagePath
      ])

      await unlink(videoPath)

      isOutputExists = existsSync(imagePath)
      if (isOutputExists) {
        const _buf = await readFileSync(imagePath)

        await sharp(_buf)
          .resize(width, height, { fit: 'cover' })
          .jpeg({
            quality: 75,
            // progressive: true
          })
          .toBuffer()
          .then(async (__buf) => {
            const inserted = await fastify.mongo.db
              .collection('Files')
              .insertOne({
                originId: fileId,
                filename: 'thumbnail.jpg',
                mimetype: 'image/jpeg',
                postedAt: new Date(),
                ...(params || {})
              })

            thumbnailId = inserted.insertedId

            await SaveFile(String(thumbnailId), __buf, 'image/jpeg')

            await fastify.mongo.db
              .collection('Files')
              .updateOne({
                _id: fileId,
              }, {
                $set: {
                  thumbnailId: thumbnailId
                }
              })
          })
          .catch(async (e) => {
            console.log(e)
            throw e
          })
      }

      await unlink(imagePath)
    }
  } catch (e) {
    console.log('ThumbnailFile:', e)
  }

  return thumbnailId
}
*/

/*
export const ConvertImage = async (fastify, file, type) => {
  let ret = await fastify.mongo.db
    .collection('Converts')
    .findOne({
      baseId: file._id,
      type: type,
    })

  if (ret && ret.converted) {
    return ret.convertedId
  }

  let _id

  if (!ret) {
    await fastify.mongo.db
      .collection('Converts')
      .updateOne({
        baseId: file._id,
        type: type
      }, {
        $set: {
          converted: false
        }
      }, {
        upsert: true
      })

    const _buf = await LoadFile(String(file._id))

    if (type === 'alternate') {
      await sharp(_buf)
        .jpeg({
          quality: 75,
          // progressive: true
        })
        .toBuffer()
        .then(async (buf) => {
          let filename
          if (file.filename.match(/\.heic/)) {
            filename = file.filename.replace(/.heic/, '.jpg')
          } else {
            filename = file.filename + '.jpg'
          }

          const inserted = await fastify.mongo.db
            .collection('Files')
            .insertOne({
              originId: file._id,
              filename: filename,
              mimetype: 'image/jpeg',
              postedAt: new Date()
            })

          _id = inserted.insertedId

          await SaveFile(String(_id), buf, 'image/jpeg')

          await fastify.mongo.db
            .collection('Files')
            .updateOne({
              _id: file._id,
            }, {
              $set: {
                alternateId: _id
              }
            })

          await fastify.mongo.db
            .collection('Converts')
            .updateOne({
              baseId: file._id,
              type: type
            }, {
              $set: {
                converted: true,
                convertedId: _id
              }
            })

        })
        .catch(async (err) => {
        })
    } else if (type === 'thumbnail') {
      await sharp(_buf)
        .resize(640, 360, { fit: 'cover' })
        .jpeg({
          quality: 75,
          // progressive: true
        })
        .toBuffer()
        .then(async (buf) => {
          const inserted = await fastify.mongo.db
            .collection('Files')
            .insertOne({
              originId: file._id,
              filename: 'thumbnail.jpg',
              mimetype: 'image/jpeg',
              postedAt: new Date()
            })

          _id = inserted.insertedId

          await SaveFile(String(_id), buf, 'image/jpeg')

          await fastify.mongo.db
            .collection('Files')
            .updateOne({
              _id: file._id,
            }, {
              $set: {
                thumnbailId: _id
              }
            })

          await fastify.mongo.db
            .collection('Converts')
            .updateOne({
              baseId: file._id,
              type: type
            }, {
              $set: {
                converted: true,
                convertedId: _id
              }
            })
        })
        .catch(async (err) => {
        })
    }
  } else {
    let c = 0
    while (true) {
      await Wait(1000)

      ret = await fastify.mongo.db
        .collection('Converts')
        .findOne({
          baseId: file._id,
          type: type,
          converted: true
        })

      if (ret && ret.converted) {
        _id = ret.convertedId
      }

      c++
      if (c > 30) {
        break
      }
    }
  }

  return _id
}
*/

export const GenerateNotice = async (fastify, req, action, currentUserId, toUserIds, postId, teamId) => {
  let notice = {
    action: action,
    postedBy: currentUserId,
    postedAt: new Date()
  }

  if (postId) {
    notice.postId = postId
  }
  if (teamId) {
    notice.teamId = teamId
  }

  for (const toUserId of toUserIds) {
    notice.to = toUserId

    const refuse = await fastify.mongo.db
      .collection('Refuses')
      .findOne({
        userId: toUserId,
        otherId: currentUserId,
        deleted: { $ne: true },
        refuse: true,
      })
    if (refuse) {
      continue
    }

    await fastify.mongo.db
      .collection('Notices')
      .insertOne(Clone(notice))
  }
}

export const EmitBackgroundNotice = async (fastify, action, notice) => {
  try {
    await fastify.io.emit('msg', `data:application/vnd.${action},${encodeURIComponent(JSON.stringify(notice))}`)
  } catch (e) {
    console.log(e)
    return false
  }
  return true
}

export const FormatDocumentsAsString = (documents) => {
  return documents.map((document) => document.pageContent).join("\n")
}

let vectorStoreRetriever

const initVectorStore = async (fastify, config) => {
  let texts = ''
  texts += 'プライバイシーポリシー\n'
  for (const _text of StripHtmlTags(config.privacypolicy).trim().split('\n')) {
    if (_text.trim() != '') {
      texts += _text.trim() + '\n'
    }
  }
  texts += '利用規約\n'
  for (const _text of StripHtmlTags(config.termsofuse).trim().split('\n')) {
    if (_text.trim() != '') {
      texts += _text.trim() + '\n'
    }
  }

  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([texts])
  const vectorStore = await MemoryVectorStore.fromDocuments(
    docs,
    new OpenAIEmbeddings()
  )

  vectorStoreRetriever = vectorStore.asRetriever()
}

export const ModeratePost = async (fastify, config, text) => {
  if (!vectorStoreRetriever) {
    await initVectorStore(fastify, config)
  }
  const SYSTEM_TEMPLATE = `答えが分からない場合は「分からない」と返して。無理に答えを作らないで
  ----------------
  {context}`

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
    ['human', `{question}`],
  ])

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: 0,
    maxTokens: undefined,
    timeout: undefined,
    maxRetries: 2,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const chain = RunnableSequence.from([
    {
      context: vectorStoreRetriever.pipe(FormatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    prompt,
    model,
    new StringOutputParser(),
  ])

  const res = await chain.invoke(
    `「${text}」はSNSの投稿文。文章が攻撃的ではなく誹謗中傷やハラスメントも含んでおらず、プライバシーポリシーや利用規約や公序良俗に反していなければ「OK」だけを返して。逆に反していたら「NG」を返して。判断がつかないときは投稿の内容やリンクから類推して再度判断して。リンクに問題がある場合でリンク先がメジャーなサービスの場合は各国法を順守しているはずなおので「OK」だけを返して。それでも判断がつかない時は「DONNO」を返して。「NG」や「DONNO」の場合は続けて理由も返して`
  )

  return res
}

export const ModerateMessage = async (fastify, config, text) => {
  if (!vectorStoreRetriever) {
    await initVectorStore(fastify, config)
  }
  const SYSTEM_TEMPLATE = `答えが分からない場合は「分からない」と返して。無理に答えを作らないで
  ----------------
  {context}`

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
    ['human', `{question}`],
  ])

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: 0,
    maxTokens: undefined,
    timeout: undefined,
    maxRetries: 2,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const chain = RunnableSequence.from([
    {
      context: vectorStoreRetriever.pipe(FormatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    prompt,
    model,
    new StringOutputParser(),
  ])

  const res = await chain.invoke(
    `「${text}」はDMのメッセージ。メッセージが攻撃的ではなく誹謗中傷やハラスメントも含んでおらず、プライバシーポリシーや利用規約や公序良俗に反していなければ「OK」だけを返して。逆に反していたら「NG」を返して。判断がつかないときは内容を類推して再度判断して。それでも判断がつかない時は「DONNO」を返して。「NG」や「DONNO」の場合は続けて理由も返して`
  )

  return res
}

const convertToEmbedUrl = (url) => {
  /*
  const match = url.match(/https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`
  }
  */
  return url
}

/*
const fetchExternalFile = async (originalUrl, depth) => {
  const embedUrl = convertToEmbedUrl(originalUrl)

  let ret = null
  if (!depth) { depth = 0 }
  depth++
  if (depth > 3) { return null }

  try {
    let res = await curly.get(embedUrl, {
      connectTimeout: 30000,
      followLocation: true,
      httpHeader: [
        'User-Agent: EcomyuCrawler/1.0',
        'Accept: text/html'
      ]
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const p5ast = parse(res.data, { sourceCodeLocationInfo: true })
      const dom = fromParse5(p5ast)

      let ogUrl = selectMetaContent(dom, 'og:url')

      if (ogUrl && embedUrl !== ogUrl) {
        res = await fetchExternalFile(ogUrl, depth + 1)
        if (res && res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          ret = { statusCode: res.statusCode, data: res.data, headers: res.headers }
        }
      } else {
        ret = { statusCode: res.statusCode, data: res.data, headers: res.headers }
      }
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      if (res.headers && res.headers[0]) {
        let location = null

        for (const header of file.headers) {
          for (const key in header) {
            if (key.toLowerCase() === 'location' && typeof header[key] === 'string') {
              location = header[key]
              break
            }
          }
          if (location) break
        }

        if (location) {
          res = await fetchExternalFile(location, depth + 1)
          if (res && res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            ret = { statusCode: res.statusCode, data: res.data, headers: res.headers }
          }
        }
      }
    }
  } catch(e) {
    console.log(e)
  }

  return ret
}
*/

const selectMetaContent = (dom, propertyName) => {
  let ret = null
  for (const obj of selectAll('html head meta[property="' + propertyName + '"]', dom)) {
    ret = obj.properties.content
  }
  return ret
}

const searchMetaAlternate = (dom, type) => {
  const links = selectAll('html head link[rel="alternate"]', dom)
  for (const link of links) {

    if (link.properties?.href && link.properties.type.toLowerCase().startsWith(type.toLowerCase())) {
      return { isActivitypub: true, activitypubUrl: link.properties.href }
    }
  }
  return { isActivitypub: false, activitypubUrl: null }
}

const fetchYouTubeMeta = async (videoUrl) => {
  const apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`

  try {
    const { data } = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'EcomyuCrawler/1.0 (+https://ecomyu.com)'
      }
    })

    let videoIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]+)/)
    let thumbnailUrl = data.thumbnail_url || ''

    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1]
      // 16:9の高品質画像を指定
      thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
    }

    return {
      title: data.title || '',
      description: data.description || '',
      thumbnailUrl: thumbnailUrl || '',
      authorName: data.author_name || '',
      authorUrl: data.author_url || '',
      providerName: data.provider_name || 'YouTube'
    }
  } catch (e) {
    console.log('Failed to fetch:', e.message)
    return null
  }
}

const youtubeRegexes = [
  /https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/,
  /https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)\?feature=shared/,
  /https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
]

export const ExtractLink = async (fastify, url) => {
  let link = await fastify.mongo.db
    .collection('Links')
    .findOne({
      url: url
    })

  if (link) {
    const at = link.fetchedAt || new Date()
    if (at > dayjs().subtract(7, 'days').toDate()) {
      return true
    }
  }

  link = {}

  let isYoutube = false
  let videoUrl = null

  let isActivitypub = false
  let activitypubUrl = null

  let ogTitle = ''
  let ogDescription = ''
  let ogUrl = ''
  let ogSiteName = ''
  let ogImage = ''

  for (const regex of youtubeRegexes) {
    const match = url.match(regex)
    if (match && match[1]) {
      isYoutube = true
      const videoId = match[2] || match[1]
      videoUrl = `https://youtu.be/${videoId}`
      break
    }
  }

  if (isYoutube) {
    const meta = await fetchYouTubeMeta(videoUrl)
    if (meta) {
      ogTitle = meta.title
      ogDescription = meta.description || `YouTubeチャンネル: ${meta.authorName}`
      ogUrl = videoUrl
      ogSiteName = meta.providerName
      ogImage = meta.thumbnailUrl
    }
  } else {
    const file = await fetchExternalFile(url)

    if (file && file.statusCode >= 200 && file.statusCode < 300 && file.headers && file.headers[0]) {
      let isHtml = false

      for (const header of file.headers) {
        for (const key in header) {
          if (key.toLowerCase() === 'content-type' && typeof header[key] === 'string' && header[key].includes('text/html')) {
            isHtml = true
            break
          }
        }
        if (isHtml) break
      }

      if (!isHtml) {
        return false
      }

      const p5ast = parse(file.data, { sourceCodeLocationInfo: true })
      const dom = fromParse5(p5ast)

      ogTitle = selectMetaContent(dom, 'og:title')
      ogDescription = selectMetaContent(dom, 'og:description')
      ogUrl = selectMetaContent(dom, 'og:url')
      ogSiteName = selectMetaContent(dom, 'og:site_name')
      ogImage = selectMetaContent(dom, 'og:image')

      const metaAlt = searchMetaAlternate(dom, 'application/activity+json')
      isActivitypub = metaAlt.isActivitypub
      activitypubUrl = metaAlt.activitypubUrl

      if (isActivitypub && activitypubUrl) {
        const headRes = await curly.head(activitypubUrl, {
          connectTimeout: 30000,
          followLocation: true,
          httpHeader: [
            'User-Agent: EcomyuCrawler/1.0',
            'Accept: application/activity+json'
          ]
        })

        let headContentType = ''
        const header = headRes.headers?.[0] || {}

        for (const key in header) {
          if (key.toLowerCase() === 'content-type') {
            headContentType = header[key].toLowerCase()
            break
          }
        }

        if (!headRes || headRes.statusCode < 200 || headRes.statusCode > 300 || !headContentType.startsWith('application/activity+json')) {
          isActivitypub = false
          activitypubUrl = null
        }
      }

      if (url !== ogUrl) {
        console.log('mismatched url', url, '!==', ogUrl, ' :', ogTitle)
      }
    } else {
      console.log('response data unprocessed', file)

      return false
    }
  }

  if (ogTitle) {
    try {
      link.title = ogTitle

      if (ogDescription) {
        link.description = ogDescription
      }
      if (ogUrl) {
        link.url = ogUrl
      }
      if (url !== ogUrl) {
        link.url = url
      }
      if (ogSiteName) {
        link.siteName = ogSiteName
      }
      if (ogImage) {
        link.image = ogImage
      }

      if (isYoutube) {
        link.type = 'youtube'
      } else if (isActivitypub) {
        link.type = 'activitypub'
        link.activitypubUrl = activitypubUrl
      }

      link.fetchedAt = new Date()

      await fastify.mongo.db
        .collection('Links')
        .updateOne({
          url: url,
        }, {
          $set: link
        }, {
          upsert: true
        })
    } catch(e) {
      console.log(e)
    }
  }

  return true
}

export const ExternalFollowerUsers = async (fastify, user) => {
  let followUserIds = []
  const follows = await fastify.mongo.db
    .collection('Follows')
    .find({
      otherUserId: user._id,
    })
    .sort({
      followedAt: -1
    })
    .toArray()
  if (follows.length === 0) return []

  for (let follow of follows) {
    followUserIds.push(follow.userId)
  }

  let ret = []

  const followUsers = await fastify.mongo.db
    .collection('Users')
    .find({
      _id: { $in: followUserIds },
      external: { $exists: true },
    })
    .toArray()

  for (const followUser of followUsers) {
    const inbox = followUser.actorEndpoints?.sharedInbox || followUser.actorEndpoints?.inbox
    if (!inbox) continue

    const already = ret.find((row) => {
      return row.inbox === inbox
    })

    if (!already) {
      ret.push({
        id: followUser.id,
        actorUrl: followUser.actorUrl,
        inbox: inbox,
      })
    }
  }

  return ret
}

export const VerifyActivitypubSignature = async (req, username) => {
  const signatureHeader = req.headers.signature
  if (!signatureHeader) throw new Error('Missing Signature header')

  const signatureParams = {}
  signatureHeader.split(',').forEach(part => {
    const [key, value] = part.trim().split('=')
    signatureParams[key] = value.replace(/^"|"$/g, '')
  })

  const headersList = signatureParams.headers.split(' ')
  let signedString = ''

  for (let h of headersList) {
    if (h === '(request-target)') {
      if (username) {
        signedString += `(request-target): post /activitypub/users/${username}/inbox\n`
      } else {
        signedString += `(request-target): post /activitypub/inbox\n`
      }
    } else {
      signedString += `${h.toLowerCase()}: ${req.headers[h.toLowerCase()]}\n`
    }
  }

  signedString = signedString.trim()

  const actorUrl = signatureParams.keyId.split('#')[0]
  const actorRes = await axios.get(actorUrl, {
    headers: { Accept: 'application/activity+json' }
  })
  const actor = actorRes.data

  const publicKeyPem = actor.publicKey?.publicKeyPem
  if (!publicKeyPem) throw new Error('Missing publicKeyPem')

  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(signedString)
  verify.end()

  const signature = Buffer.from(signatureParams.signature, 'base64')
  const isValid = verify.verify(publicKeyPem, signature)

  if (!isValid) throw new Error('Invalid Signature')
}

export const Actor2Hash = async (actor) => {
  let id, domain, handle, actorUrl

  try {
    actorUrl = actor.id || actor.url

    handle = actor.preferredUsername || actor.name

    const mastodonPattern = /^https:\/\/([^\/]+)\/users\/([^\/]+)$/
    const match = actorUrl.match(mastodonPattern)

    if (match) {
      domain = match[1]
      const username = match[2]
      id = `${username}@${domain.replace(/\./g, '_')}`.toLowerCase()
    }
  } catch (e) {
  }
  if (!domain) {
    try {
      const url = new URL(actorUrl)
      domain = url.hostname
    } catch (e) {
      domain = 'unknown'
    }
  }
  if (!id) {
    id = crypto.createHash('sha256').update(actorUrl).digest('hex').substring(0, 12) + '@' + domain.replace(/\./g, '_')
  }
  if (!handle) {
    handle = id.split('@')[0]
  }
  return { id: id, domain: domain, handle: handle, actorUrl: actorUrl }
}

export const SendActivityPub = async (actorUrl, activity, userId, privateKey) => {
  const actorRes = await axios.get(actorUrl, {
    headers: { Accept: 'application/activity+json' }
  })
  const actor = actorRes.data
  const inboxUrl = actor.endpoints?.sharedInbox || actor.inbox
  if (!inboxUrl) throw new Error('Target user has no inbox')

  const body = JSON.stringify(activity)
  const date = new Date().toUTCString()
  const digest = 'SHA-256=' + crypto.createHash('sha256').update(body).digest('base64')

  const url = new URL(inboxUrl)
  const signingString = [
    `(request-target): post ${url.pathname}`,
    `host: ${url.hostname}`,
    `date: ${date}`,
    `digest: ${digest}`
  ].join('\n')

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signingString)
  signer.end()
  const signature = signer.sign(privateKey).toString('base64')

  const signatureHeader = [
    `keyId="${urlJoin(process.env.ACTIVITYPUB_URL, 'users', userId)}#main-key"`,
    `algorithm="rsa-sha256"`,
    `headers="(request-target) host date digest"`,
    `signature="${signature}"`
  ].join(',')

  await axios.post(inboxUrl, body, {
    headers: {
      Host: url.hostname,
      Date: date,
      Digest: digest,
      Signature: signatureHeader,
      'Content-Type': 'application/activity+json'
    }
  })
}
