# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)
This project was bootstrapped with Fastify-CLI.

## Available Scripts

In the project directory, you can run:

### `pnpm run dev`

To start the app in dev mode.\
Open [http://localhost:5000](http://localhost:5000) to view it in the browser.

### `pnpm run srart`

For production mode

## Learn More

To learn Fastify, check out the [Fastify documentation](https://www.fastify.io/docs/latest/).

### batches

```
nf -e .env -j batches/createTags.proc start

node batches/cleanPosts.mjs; node batches/cleanUsers.mjs; node batches/cleanFiles.mjs; node batches/cleanOthers.mjs; node batches/countTags.mjs;
```

Indexes
---
```
db.Users.createIndex({ id: 1 });
db.Users.createIndex({ handle: 1 });
db.Users.createIndex({ email: 1 });
db.Users.createIndex({ phone: 1 });
db.Users.createIndex({ external: 1 });
db.Users.createIndex({ deleted: 1 });
db.Users.createIndex({ latestJoinedAt: 1 });
db.Users.createIndex({ postedAt: 1 });

db.Follows.createIndex({ userId: 1 });
db.Follows.createIndex({ otherUserId: 1 });
db.Follows.createIndex({ status: 1 });
db.Follows.createIndex({ followedAt: 1 });
db.Follows.createIndex({ userId: 1, otherUserId: 1, status: 1 });
db.Follows.createIndex({ otherUserId: 1, userId: 1, status: 1 });

db.Blocks.createIndex({ userId: 1 });
db.Blocks.createIndex({ otherUserId: 1 });

db.Signups.createIndex({ id: 1 });
db.Signups.createIndex({ uid: 1 });
db.Signups.createIndex({ email: 1 });
db.Signups.createIndex({ expiresIn: 1 });
db.Signups.createIndex({ finished: 1 });
db.Signups.createIndex({ deleted: 1 });

db.Requests.createIndex({ id: 1 });
db.Requests.createIndex({ email: 1 });
db.Requests.createIndex({ randomKey: 1 });
db.Requests.createIndex({ expiresIn: 1 });
db.Requests.createIndex({ registed: 1 });

db.Mails.createIndex({ sent: 1 });
db.Mails.createIndex({ failed: 1 });
db.Mails.createIndex({ postedAt: 1 });

db.Posts.createIndex({ parentId: 1 });
db.Posts.createIndex({ text: 1 });
db.Posts.createIndex({ tags: 1 });
db.Posts.createIndex({ deleted: 1 });
db.Posts.createIndex({ postedAt: 1 });
db.Posts.createIndex({ postedBy: 1 });
// db.Posts.createIndex({ text: "text", tags: "text" })

db.Videos.createIndex({ id: 1 });

db.Tags.createIndex({ text: 1 });
db.Tags.createIndex({ count: 1 });
db.Tags.createIndex({ postedAt: 1 });
db.Tags.createIndex({ deleted: 1 });

db.Files.createIndex({ userId: 1 });
db.Files.createIndex({ postId: 1 });
db.Files.createIndex({ deleted: 1 });

db.Likes.createIndex({ postId: 1 });
db.Likes.createIndex({ userId: 1 });

db.Saws.createIndex({ postId: 1 });
db.Saws.createIndex({ userId: 1 });

db.Chats.createIndex({ userIds: 1 });
db.Chats.createIndex({ chattedAt: 1 });
db.Chats.createIndex({ deleted: 1 });

db.Messages.createIndex({ userId: 1 });
db.Messages.createIndex({ chatId: 1 });
db.Messages.createIndex({ postedAt: 1 });
db.Messages.createIndex({ deleted: 1 });

db.Notices.createIndex({ to: 1 });
db.Notices.createIndex({ postedAt: 1 });
db.Notices.createIndex({ saw: 1 });

db.Reactions.createIndex({ messageId: 1, userId: 1 }, { unique: true })
db.Reactions.createIndex({ messageId: 1 })
db.Reactions.createIndex({ chatId: 1 })

db.Refuses.createIndex({ userId: 1 });
db.Refuses.createIndex({ otherId: 1 });
db.Refuses.createIndex({ refuse: 1 });
db.Refuses.createIndex({ deleted: 1 });

db.Teams.createIndex({ id: 1 });
db.Teams.createIndex({ name: 1 });
db.Teams.createIndex({ postedAt: 1 });
db.Teams.createIndex({ deleted: 1 });

db.Members.createIndex({ teamId: 1 });
db.Members.createIndex({ userId: 1 });
db.Members.createIndex({ postedAt: 1 });
db.Members.createIndex({ deleted: 1 });

db.Auths.createIndex({ userId: 1 });
db.Auths.createIndex({ platform: 1 });
db.Auths.createIndex({ userId: 1, platform: 1 });
db.Auths.createIndex({ accessToken: 1 });
db.Auths.createIndex({ refreshToken: 1 });
db.Auths.createIndex({ updatedAt: 1 });

db.Crossposts.createIndex({ postId: 1 });
db.Crossposts.createIndex({ platform: 1 });
db.Crossposts.createIndex({ externalId: 1 });
db.Crossposts.createIndex({ postedBy: 1 });
db.Crossposts.createIndex({ postedAt: 1 });
db.Crossposts.createIndex({ postId: 1, platform: 1 });
```

activitypub
---
```
    location = /.well-known/webfinger {
        proxy_pass http://api/api/activitypub/;
    }
    location /users/ {
        proxy_pass http://api/api/activitypub/users/;
    }
    #location /notes/ {
    #    proxy_pass http://api/api/activitypub/notes/;
    #}
    #location /activities/ {
    #    proxy_pass http://api/api/activitypub/activities/;
    #}
```
