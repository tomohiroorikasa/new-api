import * as crypto from 'node:crypto'

import urlJoin from 'url-join'

import { IsBoolean, IsNumber, Clone, GetConfig, CurrentUser, ValidateData, RecursiveEach, AutoTags, StripHtmlTags, ExtractLink, FormatDocumentsAsString } from '../../lib.mjs'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

import reallyRelaxedJson from 'really-relaxed-json'
const { toJson } = reallyRelaxedJson

import Autolinker from 'autolinker'

import { marked } from 'marked'

dayjs.extend(utc)
dayjs.locale('ja')

const useFullText = process.env.DB_FULLTEXT === '1'
const useAtlasSearch = process.env.DB_ATLASSEARCH === '1'

const schema = {
  draft: 1,
  id: 1,
  type: 1,
  title: 1,
  description: 1,
  links: 1,
}

const postRules = {
  draft: {
    isBoolean: true
  },
  id: {
    // required: true,
    maxLength: 100,
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
  fastify.get('/count', async (req, reply) => {
    let count = 0

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      let matches = {
        $and: [
          { parentId: { $exists: false } },
          // { deleted: { $ne: true } }
        ]
      }

      let currentUser
      let blockUsers
      if (email) {
        currentUser = await CurrentUser(fastify, email)
        if (currentUser) {
          blockUsers = await BlockUsers(fastify, currentUser)
        }
      }

      if (!currentUser) {
        matches.$and.push({
          draft: { $ne: true }
        })
      } else {
        matches.$and.push({
          $or: [{
            draft: { $ne: true },
          }, {
            postedBy: currentUser._id
          }]
        })
      }

      if (currentUser && blockUsers && blockUsers.length > 0) {
        matches.$and.push({ postedBy: { $nin: blockUsers } })
      }

      let isSearch = false
      let keywords = []

      if (req.query.filter && req.query.filter !== '') {
        let queryFilter = JSON.parse(toJson(req.query.filter))

        if (queryFilter.$and && queryFilter.$and.length > 0) {
          for (let i = 0; i < queryFilter.$and.length; i++) {
            const cond = queryFilter.$and[i]

            if (cond && cond.$keywords) {
              isSearch = true

              if (useAtlasSearch) {
                keywords.push(...cond.$keywords)

                delete queryFilter.$and[i]
              } else if (useFullText) {
                queryFilter.$and[i] = {
                  $text: { $search: keywords }
                }
              } else {
                let keywordFilters = []

                cond.$keywords.forEach((keyword) => {
                  keywordFilters.push({
                    text: {
                      $regex: keyword,
                      $options: 'i'
                    }
                  })
                })

                queryFilter.$and[i] = {
                  $or: keywordFilters
                }
              }
            }
          }

          queryFilter.$and = queryFilter.$and.filter(Boolean)
        }

        RecursiveEach(queryFilter, (key, value) => {
          if (value === null) {
            return null
          } else if (IsBoolean(value)) {
            return value
          } else if (IsNumber(value)) {
            return value
          } else if (value.match(/^Date:\(\'(.+)\'\)$/)) {
            return dayjs(RegExp.$1).toDate()
          } else if (value.match(/^ObjectId:\(\'(.+)\'\)$/)) {
            return new fastify.mongo.ObjectId(RegExp.$1, 'g')
          } else {
            return null
          }
        })

        matches.$and.push(queryFilter)
      }

      let aggregate = []

      if (isSearch && keywords.length > 0 && useAtlasSearch) {
        const phrases = []

        for (const keyword of keywords) {
          phrases.push({
            phrase: {
              query: keyword,
              path: ['text']
            }
          })
        }

        aggregate.push({
          $search: {
            index: 'default',
            compound: {
              must: phrases
            },
            // highlight: { path: { wildcard: '*' } }
          }
        })
      }

      aggregate.push({
        $match: matches
      })

      aggregate.push({ $count: 'count' })

      const arr = await fastify.mongo.db
        .collection('Pages')
        .aggregate(aggregate)
        .toArray()
      if (arr.length > 0 && arr[0] && arr[0].count) {
        count = arr[0].count
      }
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return count
  })

  fastify.get('/', async (req, reply) => {
    let data = []

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      let matches = {
        $and: [
          { parentId: { $exists: false } },
          // { deleted: { $ne: true } }
        ]
      }

      let currentUser
      let blockUsers
      if (email) {
        currentUser = await CurrentUser(fastify, email)
        if (currentUser) {
          blockUsers = await BlockUsers(fastify, currentUser)
        }
      }

      if (!currentUser) {
        matches.$and.push({
          draft: { $ne: true }
        })
      } else {
        matches.$and.push({
          $or: [{
            draft: { $ne: true },
          }, {
            postedBy: currentUser._id
          }]
        })
      }

      if (currentUser && blockUsers && blockUsers.length > 0) {
        matches.$and.push({ postedBy: { $nin: blockUsers } })
      }

      let isSearch = false
      let keywords = []

      if (req.query.filter && req.query.filter !== '') {
        let queryFilter = JSON.parse(toJson(req.query.filter))

        if (queryFilter.$and && queryFilter.$and.length > 0) {
          for (let i = 0; i < queryFilter.$and.length; i++) {
            const cond = queryFilter.$and[i]

            if (cond && cond.$keywords) {
              isSearch = true

              if (useAtlasSearch) {
                keywords.push(...cond.$keywords)

                delete queryFilter.$and[i]
              } else if (useFullText) {
                queryFilter.$and[i] = {
                  $text: { $search: keywords }
                }
              } else {

                let keywordFilters = []

                cond.$keywords.forEach((keyword) => {
                  keywordFilters.push({
                    text: {
                      $regex: keyword,
                      $options: 'i'
                    }
                  })
                })

                queryFilter.$and[i] = {
                  $or: keywordFilters
                }
              }
            }
          }

          queryFilter.$and = queryFilter.$and.filter(Boolean)
        }

        RecursiveEach(queryFilter, (key, value) => {
          if (value === null) {
            return null
          } else if (IsBoolean(value)) {
            return value
          } else if (IsNumber(value)) {
            return value
          } else if (value.match(/^Date:\(\'(.+)\'\)$/)) {
            return dayjs(RegExp.$1).toDate()
          } else if (value.match(/^ObjectId:\(\'(.+)\'\)$/)) {
            return new fastify.mongo.ObjectId(RegExp.$1, 'g')
          } else {
            return null
          }
        })

        matches.$and.push(queryFilter)
      }

      let projects = {
        _id: 1,
        postedAt: 1
      }

      projects = Object.assign(projects, schema)

      if (req.query.sort) {
        let addFields = {}
        for (let field of req.query.sort.split(',')) {
          if (field.substr(0, 1) === '-') {
            field = field.substr(1)
          }
          addFields[field] = 1
        }

        projects = Object.assign(projects, addFields)
      }

      let aggregate = []

      if (isSearch && keywords.length > 0 && useAtlasSearch) {
        const phrases = []

        for (const keyword of keywords) {
          phrases.push({
            phrase: {
              query: keyword,
              path: ['text']
            }
          })
        }

        aggregate.push({
          $search: {
            index: 'default',
            compound: {
              must: phrases
            },
            // highlight: { path: { wildcard: '*' } }
          }
        })

        projects.score = { $meta: 'searchScore' }
      }

      aggregate.push({
        $match: matches
      }, {
        $project: projects
      })

      /*
      let aggregate = [
        {
          $match: matches
        }, {
          $lookup: {
            from: 'Users',
            localField: 'postedBy',
            foreignField: '_id',
            as: 'PostedBy'
          }
        }, {
          $unwind: {
            path: '$PostedBy',
            preserveNullAndEmptyArrays: true
          }
        }
      ]

      aggregate.push({
        $project: Object.assign({
          _id: 1,
          postedAt: 1,
          // postedBy: 1,
          'PostedBy._id': 1,
          'PostedBy.id': 1,
          'PostedBy.handle': 1,
          'PostedBy.avatarId': 1,
          'PostedBy.color': 1,
          'PostedBy.deleted': 1,
        }, schema)
      })
      */

      if (isSearch && keywords.length && useAtlasSearch) {
        aggregate.push({
          $sort: {
            score: -1
          }
        })
      } else if (req.query.sort) {
        let sort = {}
        for (let field of req.query.sort.split(',')) {
          let order = 1
          if (field.substr(0, 1) === '-') {
            field = field.substr(1)
            order = -1
          }
          sort[field] = order
        }
        aggregate.push({ $sort: sort })
      }

      let skip = 0
      if (req.query.skip) {
        skip = Number(req.query.skip)
      }

      if (skip > 0) {
        aggregate.push({ $skip: skip })
      }
      let limit = 100
      if (req.query.limit) {
        limit = Number(req.query.limit)
      }
      if (limit !== -1) {
        aggregate.push({ $limit: limit })
      }

      data = await fastify.mongo.db
        .collection('Pages')
        .aggregate(aggregate)
        .toArray()

      /*
      if (req.query.fields && req.query.fields !== '') {
        let temp = await fastify.mongo.db
          .collection('Pages')
          .aggregate(aggregate)
          .toArray()
        data = temp.map((hash) => {
          let newHash = {
            _id: hash._id
          }
          for (let field of req.query.fields.split(',')) {
            if (hash[field] !== undefined) {
              newHash[field] = hash[field]
            }
          }
          return newHash
        })
      } else {
        data = await fastify.mongo.db
          .collection('Pages')
          .aggregate(aggregate)
          .toArray()
      }
      */
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return data
  })
}
