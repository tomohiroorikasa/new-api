import fs from 'fs'
import path from 'path'

// import { IsBoolean, IsNumber, Clone, FilterData, GetConfig, CurrentUser, AdUsers, Followers, Members, ValidateData, RecursiveEach,  AutoTags, ExtractLink, ExistsFile, SaveFile, LoadFile } from "../../../lib.mjs"

import { FilterData, GetConfig, GetUid } from '../../../lib.mjs'

const schema = {
  uid: 1,
  name: 1,
  email: 1,
  deleted: 1
}

export default async function (fastify, opts) {

}
