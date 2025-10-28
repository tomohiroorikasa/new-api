import fastifyPlugin from 'fastify-plugin'

import axios from 'axios'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

dayjs.extend(utc)
dayjs.locale('ja')

export default fastifyPlugin(async (fastify, opts) => {
  const domain = process.env.AUTH0_DOMAIN
  const audience = process.env.AUTH0_AUDIENCE
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  let token = null
  let expireIn = null

  fastify.auth0 = {
    refreshAccessToken: async () => {
      if (!token || !expireIn || expireIn < new Date()) {
        try {
          const res = await axios.post(`https://${domain}/oauth/token`, {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience: `https://${domain}/api/v2/`,
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
          if (res && res.data && res.data.access_token) {
            let now = new Date()
            now.setSeconds(now.getSeconds() + Number(res.data.expires_in) - 100)

            expireIn = now

            token = `${res.data.token_type} ${res.data.access_token}`
          }
        } catch (e) {
          console.error(e)
          return false
        }
      }
    },
    addUser: async (user) => {
      await fastify.auth0.refreshAccessToken()

      try {
        const res = await axios.get(`https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(user.email)}`, {
          headers: {
            Authorization: token
          }
        })

        let userId = null
        if (res && res.data && res.data[0]) {
          userId = res.data[0].user_id
        }

        let data = {}

        if (res && res.data && res.data.length > 0) {
          if (user.password) {
            data.password = user.password
          }

          await axios.patch(`https://${domain}/api/v2/users/${userId}`, data, {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json'
            }
          })
        } else {
          data.email = user.email
          data.email_verified = true
          data.connection = 'Username-Password-Authentication'

          if (user.password) {
            data.password = user.password
          }

          await axios.post(`https://${domain}/api/v2/users`, data, {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json'
            }
          })
        }

        return true
      } catch (e) {
        console.error(e)
        return false
      }

    },
    deleteUser: async (user) => {
      await fastify.auth0.refreshAccessToken()

      try {
        const res = await axios.get(`https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(user.email)}`, {
          headers: {
            Authorization: token
          }
        })

        if (res && res.data && res.data.length > 0) {
          const ret = await axios.delete(`https://${domain}/api/v2/users/${res.data[0].user_id}`, {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json'
            }
          })

          return true
        }
      } catch (e) {
        console.error(e)
        return false
      }
    },
    changePassword: async () => {
      // 未実装
    },
    checkSignIn: async (fastify, headers) => {
      const token = headers.authorization
      if (!token) {
        return null
      }

      const expirein = headers.expirein
      if (!expirein) {
        return null
      }

      let email = await fastify.redis.get(token)

      if (!email) {
        try {
          const url = `https://${process.env.AUTH0_DOMAIN}/userinfo`

          const config = {
            headers: {
              authorization: token
            }
          }

          const res = await axios.get(url, config)
          if (res && res.data) {
            email = res.data.email

            await fastify.redis.set(token, email)
            await fastify.redis.expire(token, dayjs(decodeURIComponent(expirein)).diff(dayjs(),'second'))
          }
        } catch (e) {
          console.error(e)
        }
      }

      /*
      if (email) {
        await fastify.mongo.db.collection('Users').updateOne({
          email: email,
          deleted: { $ne: true }
        }, {
          $set: {
            joined: true,
            latestJoinedAt: new Date()
          }
        })
      }
      */

      return email
    },
    checkSocketToken: async (fastify, handshakeAuth) => {
      const token = handshakeAuth.token
      if (!token) {
        return null
      }

      let email = await fastify.redis.get(token)

      /*
      if (!email) {
        try {
          const url = `https://${process.env.AUTH0_DOMAIN}/userinfo`

          const config = {
            headers: {
              authorization: token
            }
          }

          const res = await axios.get(url, config)

          if (res && res.data) {
            email = res.data.email

            await fastify.redis.set(token, email)
            await fastify.redis.expire(token, 60)
          }
        } catch (e) {
          console.error(e)
        }
      }
      */
      return email
    }
  }
})
