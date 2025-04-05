# AI Chat Workflows Automation App

A Rocket.Chat App that allows you to automate workflows based on message events in channels.

## Features

- Define workflows with slash commands
- Trigger workflows based on message contents, users, or rooms
- Execute actions like DM, delete message, or post to another channel
- Multi-step workflows (chain multiple actions for a single trigger)

## Installation

1. Make sure you have the Rocket.Chat Apps CLI installed:
   ```
   npm install -g @rocket.chat/apps-cli
   ```

2. Clone this repository:
   ```
   git clone https://github.com/yourusername/ai-workflow-automation
   cd ai-workflow-automation
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Build the app:
   ```
   rc-apps package
   ```

5. Deploy to your Rocket.Chat server:
   ```
   rc-apps deploy -u http://your-rocketchat-server -e
   ```

## Usage

### Creating Workflows

Use the `/workflow` slash command to create and manage workflows:

```
/workflow create @user #room contains=hello action=dm:@target="Hello there!"
```

### Workflow Triggers

You can combine multiple trigger conditions:

- `@username` - Trigger only for messages from this user
- `#roomname` - Trigger only in this room
- `contains=text` - Trigger if message contains this text
- `startsWith=text` - Trigger if message starts with this text
- `regex=pattern` - Trigger if message matches this regex pattern

### Workflow Actions

You can specify multiple actions to execute:

- `action=dm:@user="message"` - Send a DM to a user
- `action=delete` - Delete the triggering message
- `action=post:#room="message"` - Post a message to a channel

### Managing Workflows

```
/workflow list
/workflow delete [workflow_id]
/workflow enable [workflow_id]
/workflow disable [workflow_id]
```

## Development

1. Run in development mode:
   ```
   rc-apps run
   ```

2. Connect to your Rocket.Chat server

## License

MIT 