import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import urlJoin from 'url-join'

import autoload from '@fastify/autoload'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function (fastify, opts, done) {
  fastify.register(autoload, {
    dir: path.join(__dirname, 'plugins'),
    options: {}
  })

  fastify.register(import('./routes/root.mjs'), { prefix: process.env.PREFIX || '/' })

  const routesDirs = fs.readdirSync(path.join(__dirname, 'routes'), { withFileTypes: true })

  for (const routesDir of routesDirs) {
    if (routesDir.isDirectory()) {
      if (!process.env.ACTIVITYPUB_URL && routesDir.name === 'activitypub') continue

      const fullPath = path.join(__dirname, 'routes', routesDir.name)
      const prefix = urlJoin(process.env.PREFIX || '/', routesDir.name)

      fastify.register(autoload, {
        dir: fullPath,
        routeParams: true,
        options: {
          recursive: true,
          prefix: prefix
        }
      })
    }
  }

  /*
  fastify.register(autoload, {
    dir: routesDirs,
    routeParams: true,
    options: {
      recursive: true,
      prefix: process.env.PREFIX ? process.env.PREFIX : '/'
    }
  })
  */

  /*
  fastify.ready().then(() => {
    console.log(fastify.printRoutes())
  })
  */

  done()
}
