# 💡 AI Chat Workflows Automation App with Multi-step Reasoning PoC

## 📋 Project Overview
A Rocket.Chat app that leverages LLMs for natural language workflow automation, enabling users to create intelligent chat workflows using simple English commands. The app monitors messages in specified channels and performs automated actions based on sophisticated multi-step reasoning.

## 🎯 Project Goals
1. Create a streamlined workflow automation system
2. Implement natural language processing using LLMs
3. Enable multi-step reasoning for complex workflows
4. Ensure robust safety mechanisms

## 🚀 Features Implemented

### 1. Core Message Monitoring
- ✅ Message event handling system
- ✅ Room-specific message monitoring
- ✅ User-specific message filtering
- ✅ Pattern matching (contains, startsWith, regex)

### 2. Workflow Management
- ✅ Workflow storage and persistence
- ✅ Enable/disable workflow functionality
- ✅ Basic workflow command handling
- ✅ Workflow trigger validation

### 3. Action System
- ✅ Action execution framework
- ✅ Message sending capabilities
- ✅ Direct message support
- ✅ Multi-action workflow support

### 4. Safety & Permissions
- ✅ Message loop prevention
- ✅ Error handling and logging
- ✅ Permission-based actions
- ✅ Basic input validation

### 5. Technical Foundation
- ✅ TypeScript implementation
- ✅ Rocket.Chat Apps Engine integration
- ✅ Modular architecture
- ✅ Event-driven design

## 🔮 Future Work (90 Hours)

### 1. Manual Workflow System (~40 hours)
- 🚧 Streamlined workflow creation UI
  - Visual workflow builder
  - Step-by-step wizard interface
  - Template management
  - Action preview system
- 🚧 Workflow Management
  - Edit existing workflows
  - Duplicate workflows
  - Export/Import workflows
  - Version control
- 🚧 Action Configuration
  - Custom action types
  - Action chaining
  - Conditional branching
  - Error handling

### 2. LLM Integration 
- 🚧 Natural Language Processing
  - Command parsing using LLMs
  - Context understanding
  - Intent recognition
  - Entity extraction
- 🚧 Multi-step Reasoning
  - Step generation
  - Logic validation
  - Action sequence optimization
  - Feedback generation

### 3. Automation & Tools 
- 🚧 Function Calling System
  - Dynamic function registration
  - Parameter validation
  - Return type handling
  - Error recovery
- 🚧 Structured Inference
  - Pattern recognition
  - Context preservation
  - State management
  - Action validation

### 4. Safety Mechanisms 
- 🚧 Input Validation
  - Content filtering
  - Permission checking
  - Rate limiting
  - Resource monitoring
- 🚧 Hallucination Prevention
  - Output validation
  - Confidence scoring
  - Fallback mechanisms
  - Audit logging

### 5. Testing 
- 🚧 Test Suite
  - Unit tests
  - Integration tests
  - Safety tests
  - Performance benchmarks

## 🤖 Prompt System

The app uses a sophisticated prompt system for natural language processing and workflow generation:

### Core Prompts
```typescript
export const PROMPTS = {
    // Main instruction for workflow automation.
    workflowInstruction: `
  You are an automation assistant for Rocket.Chat. 
  When provided with a command in simple English, parse and generate a detailed multi-step workflow.
  Your workflow should include:
  1. A trigger: specifying the channel(s), user(s), or message content conditions.
  2. A process: outlining the reasoning steps required (at least two steps) to validate the command.
  3. A response: defining the messaging operation (e.g., DM, deletion) to be executed.
  Ensure safety mechanisms are in place to prevent accidental permanent changes or errors.
  Examples:
  - "whenever @sing.li posts any welcome messages in #gsoc2025, immediately DM them with a thank-you note"
  - "whenever a message is posted that contains a four letter word beginning with letter F, delete that message immediately"
  - "if my Alexa messages me asking where I am, DM her sorry I will be late"
    `,
  
    // Extract the trigger details from the user command.
    triggerExtraction: `
  Identify and extract the trigger details:
  - Which channel(s) or conversation(s) are being monitored?
  - Which user(s) or role(s) are involved (if any)?
  - What specific message conditions (keywords, patterns, etc.) need to be met?
  Provide a structured description of these trigger conditions.
    `,
  
    // Define the multi-step reasoning process.
    processReasoning: `
  Outline the multi-step reasoning process required to transform the trigger into an actionable workflow.
  Include at least two distinct reasoning steps such as:
  1. Validating the trigger conditions (e.g., correct user, channel, or message pattern).
  2. Determining the appropriate messaging operation and any intermediate actions.
  Incorporate safety checks to ensure that the actions will not lead to unintended permanent state changes.
    `,
  
    // Generate the response actions based on the reasoning.
    responseCreation: `
  Based on the validated trigger and reasoning steps, generate the required messaging actions.
  Detail the operations, such as:
  - Sending a direct message (DM) with a specified note.
  - Deleting a message containing prohibited content.
  - Any other messaging operations as described by the command.
  Ensure that the response is clear, concise, and executable within the Rocket.Chat environment.
    `,
  
    // Safety mechanism prompt to validate the final workflow.
    safetyCheck: `
  Perform a final safety check on the generated workflow.
  Verify that:
  - No unintended operations are present.
  - There are rollback or confirmation mechanisms where necessary.
  - The actions will not permanently alter critical system states.
  If any potential issues are detected, prompt for additional confirmation before execution.
    `,
  };
  
export default PROMPTS;
```

### Example Workflows
1. Welcome Message Response:
```bash
"whenever @sing.li posts welcome messages in #gsoc2025, immediately DM them with a thank-you note"
```
- Trigger: Monitor #gsoc2025 for @sing.li's messages
- Process: Validate welcome message content
- Action: Send thank-you DM

2. Content Moderation:
```bash
"whenever a message contains a four letter word beginning with F, delete that message"
```
- Trigger: Monitor all messages
- Process: Check word patterns
- Action: Delete violating messages

3. Auto-Response:
```bash
"if Alexa asks where I am, DM sorry I will be late"
```
- Trigger: Monitor Alexa's messages
- Process: Identify location queries
- Action: Send automated response

## 📊 Current Implementation Status
Based on codebase analysis:
- Core Message System: ~80% complete
- Workflow Management: ~60% complete
- Action System: ~50% complete
- Safety Features: ~40% complete
- Overall Project: ~45% complete

## 🛠️ Technical Details

### Project Structure
```
aiworkflow/
├── src/
│   ├── actions/      # Action execution system
│   ├── commands/     # Slash command handlers
│   ├── constants/    # Prompt
│   ├── handlers/     # Event handlers
│   ├── models/       # Data models & interfaces
│   ├── parsers/      # Command parsing
│   └── storage/      # Persistence layer
|   └── config/       # LLM 
```

### Dependencies
- @rocket.chat/apps-engine: ^1.44.0
- @rocket.chat/ui-kit: ^0.36.1
- @rocket.chat/icons: ^0.38.0
- TypeScript: ^5.6.2

## 🔧 Technical Implementation Details

### 1. Core Architecture
```typescript
// Main App Class Structure
class AiWorkflowApp extends App implements IPostMessageSent {
    // Message monitoring system
    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<void>

    // Workflow matching system
    private findMatchingWorkflows(
        workflows: Array<IWorkflow>, 
        message: IMessage, 
        sender: IUser, 
        room: IRoom
    ): Array<IWorkflow>
}
```

### 2. Data Models
```typescript
// Workflow Model
interface IWorkflow {
    id: string;
    enabled: boolean;
    trigger: {
        type: 'message' | 'mention';
        room?: string;
        user?: string;
        contains?: string;
        regex?: string;
    };
    actions: Array<{
        type: 'message' | 'dm' | 'delete';
        content?: string;
        target?: string;
    }>;
}

// Natural Language Parser Models
interface INLCommand {
    rawInput: string;
    trigger: ITrigger;
    steps: IReasoningStep[];
    actions: IAction[];
}
```

### 3. LLM Integration
```typescript
// Prompt System
const WORKFLOW_PROMPTS = {
    PARSE_COMMAND: `Parse English commands into structured workflow...`,
    VALIDATE_WORKFLOW: `Validate workflow for potential issues...`,
    SAFETY_CHECK: `Analyze actions for safety concerns...`
}

// LLM Interface
interface ILLMService {
    parseCommand(input: string): Promise<INLCommand>;
    validateWorkflow(workflow: IWorkflow): Promise<boolean>;
    checkSafety(actions: IAction[]): Promise<SafetyReport>;
}
```

### 4. Storage System
```typescript
// Persistence Layer
class WorkflowStorage {
    constructor(
        private readonly persistence: IPersistence,
        private readonly reader: IPersistenceRead
    ) {}

    async create(workflow: IWorkflow): Promise<void>
    async getAll(): Promise<Array<IWorkflow>>
    async update(id: string, workflow: IWorkflow): Promise<void>
    async delete(id: string): Promise<void>
}
```

### 5. Action System
```typescript
// Action Executor
class ActionExecutor {
    constructor(
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly http: IHttp,
        private readonly persistence: IPersistence
    ) {}

    async executeActions(
        actions: IAction[],
        context: IExecutionContext
    ): Promise<void>
}
```

### 6. Safety Implementation
```typescript
// Safety Checks
interface ISafetyCheck {
    validatePermissions(user: IUser, action: IAction): Promise<boolean>;
    checkRateLimits(user: IUser): Promise<boolean>;
    validateContent(content: string): Promise<ValidationResult>;
}

// Error Handling
class WorkflowError extends Error {
    constructor(
        public code: ErrorCode,
        public details: any,
        message: string
    ) {
        super(message);
    }
}
```

### 7. Project Dependencies
```json
{
    "dependencies": {
        "@rocket.chat/apps-engine": "^1.44.0",
        "@rocket.chat/ui-kit": "^0.36.1",
        "@rocket.chat/icons": "^0.38.0"
    },
    "devDependencies": {
        "typescript": "^5.6.2",
        "@types/node": "14.14.6"
    }
}
```

### 8. Required Permissions
```json
{
    "permissions": [
        "message.read",
        "message.write",
        "room.read",
        "user.read",
        "slashcommand",
        "networking",
        "persistence"
    ]
}
```

### 9. Project Structure
```
aiworkflow/
├── src/
│   ├── actions/      # Action execution system
│   ├── commands/     # Slash command handlers
│   ├── constants/    # Prompt system
│   ├── handlers/     # Event handlers
│   ├── models/       # Data models & interfaces
│   ├── parsers/      # Command parsing
│   ├── storage/      # Persistence layer
│   └── config/       # LLM configuration
├── tests/            # Test suites
└── docs/            # Documentation
```

### 10. Implementation Approach
1. **Message Monitoring**
   - Event-driven architecture using Rocket.Chat's Apps Engine
   - Real-time message processing and pattern matching
   - Efficient workflow matching algorithm

2. **Natural Language Processing**
   - Structured prompt system for command parsing
   - Multi-step reasoning pipeline
   - Entity extraction and validation

3. **Action Execution**
   - Modular action system
   - Asynchronous execution
   - Error handling and rollback

4. **Safety Features**
   - Permission-based access control
   - Content validation
   - Rate limiting
   - Error recovery

### 11. Testing Strategy
```typescript
describe('Workflow System', () => {
    it('should parse natural language commands')
    it('should validate workflow safety')
    it('should execute actions in order')
    it('should handle errors gracefully')
})
```



## 🎯 Example Use Cases

### 1. Welcome Message Automation
```bash
/workflow english "whenever @sing.li posts any welcome messages in #gsoc2025, immediately DM them with a thank-you note"
```

### 2. Content Moderation
```bash
/workflow english "whenever a message is posted that contains a four letter word beginning with letter F, delete that message immediately"
```

### 3. Auto-Response
```bash
/workflow english "if my Alexa messages me asking where I am, DM her sorry I will be late"
```

### 4. Multi-step DevOps Workflow
```bash
/workflow english "when someone says 'deploy' in #dev then send message 'Starting deployment...' to #announcements and then notify @devops and finally update #status with 'Deployment initiated'"
```

## 🛠️ Installation & Setup

1. Prerequisites:
```bash
npm install -g @rocket.chat/apps-cli
```

2. Clone & Install:
```bash
git clone https://github.com/Kishan-Patel-dev/ai-auto.git
cd ai-auto
npm install
```

3. Configure:
```bash
cp .rcappsconfig.example .rcappsconfig
# Edit .rcappsconfig with your server details username & password
```

4. Deploy:
```bash
rc-apps deploy
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Natural language command parsing
- [ ] Multi-step workflow execution
- [ ] Permission validation
- [ ] Rate limiting
- [ ] Content safety checks
- [ ] Error handling
- [ ] Hallucination prevention

### Safety Testing
```bash
# Test permission validation
/workflow english "when anyone posts in #restricted then delete message"

# Test content filtering
/workflow english "when message contains inappropriate_content then forward to #public"

# Test rate limiting
/workflow english "when @user posts then spam messages" # Should be prevented
```

## 👥 Project Team
- **Student:** Kishan Patel
- **Mentor:** Hardik Bhatia
- **Project Duration:** 90 hours
- **Difficulty:** Intermediate/Advanced

## 💪 Required Skills
- Rocket.Chat Apps Engine (TypeScript)
- Rocket.Chat messaging APIs
- Advanced prompt engineering
- Multi-step reasoning LLMs
- Tools/function-calling capabilities
- Safety-first implementation

## 📚 Documentation & Resources
- [Prompt Engineering](https://www.promptingguide.ai/)
- [Rocket.Chat Apps Hands-On Workshop](https://github.com/RocketChat/Workshop.Apps.Development/)
- [Rocket.Chat Apps Development Guide](https://developer.rocket.chat/apps-engine/getting-started)


## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments
- GSoC 2025 program
- Rocket.Chat community
- Special Thanks to Project mentor Hardik Bhatia 


## Connect with Me
- [Whatsapp](https://wa.me/918320433926)
- [X](https://x.com/KishanPatel_dev)
- [Linkedin](https://www.linkedin.com/in/kishan-patel-dev/)
- [Gmail](kishan.patel.tech.dev@gmail.com)
