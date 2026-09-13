/**
 * English translations for the Happy app
 * Values can be:
 * - String constants for static text
 * - Functions with typed object parameters for dynamic text
 */

/**
 * English plural helper function
 * @param options - Object containing count, singular, and plural forms
 * @returns The appropriate form based on count
 */
function plural({ count, singular, plural }: { count: number; singular: string; plural: string }): string {
    return count === 1 ? singular : plural;
}

export const en = {
    accountPage: {
        yourAccount: 'Your account',
        account: 'Account',
        signedIn: 'Signed in',
        accountId: 'Account id',
        platformKey: 'Platform API key',
        platformKeyHint: 'Entered on each computer and kept in that computer\u2019s credential store. This app never holds it.',
        details: 'Account details',
        detailsHint: 'Recovery key and signing out',
        archived: 'Archived agents',
        archivedHint: 'Read their history, or bring one back',
        connectors: 'Connectors',
        connectorsFooter: 'A connector is set up on the computer that will use it, so its sign-in never passes through this app.',
        connectedServices: 'Connected services',
        connectedServicesHint: 'Mail and other services your agents may use',
        computers: 'Computers',
        computersFooter: 'Open a computer to rename it, to ask before risky steps, or to remove it.',
        computerOn: 'On',
        computerOff: 'Off',
        noComputers: 'No computers yet',
        noComputersHint: 'Add the computer you want your agents to work on',
        addComputer: 'Add a computer',
        addComputerHint: 'Approve a computer that asked to join this account',
        preferences: 'Preferences',
        recoveryKey: 'Recovery key',
        recoveryKeyFooter: 'This key is the account. Keep a copy somewhere safe: anyone who has it can read your agents, and without it a lost account cannot be recovered.',
        showKey: 'Show the key',
        hideKey: 'Hide the key',
        tapToCopy: 'Tap to copy',
        copyFailedTitle: 'Could not copy',
        copyFailedMessage: 'Copying the recovery key to the clipboard failed.',
        signingOut: 'Signing out',
        signOut: 'Sign out',
        signOutHint: 'Removes this account from this app on this device',
        signOutConfirm: 'You will need your recovery key, or another computer already signed in, to get back into this account.',
    },
    archivedAgents: {
        emptyTitle: 'Nothing archived',
        emptyHint: 'Agents you put away will be listed here',
        emptyFooter: 'An agent you archive from its conversation shows up here.',
        footer: 'Opening an archived agent shows its history. Bringing it back needs its computer to be on.',
        onComputer: ({ computer }: { computer: string }) => `On ${computer}`,
        bringBack: 'Bring back',
        bringBackAgent: ({ name }: { name: string }) => `Bring back ${name}`,
        restoreFailedTitle: 'Could not bring it back',
        restoreFailedMessage: 'That computer did not answer.',
        thatComputer: 'That computer',
        computerOffline: ({ computer }: { computer: string }) => `${computer} is off. You can read this agent now and bring it back when the computer is on.`,
        computerUnknown: 'The computer this agent ran on is no longer on your account, so it can only be read.',
    },
    connectors: {
        loading: 'Reading your connections',
        footer: 'Only the service name, the computer and the connection state are stored here. The sign-in itself never leaves the computer.',
        emptyTitle: 'Nothing connected',
        emptyHint: 'Connect a service on the computer that should use it',
        unnamedService: 'Unnamed service',
        statusConnected: 'Connected',
        statusNotConnected: 'Not connected',
        disconnect: 'Disconnect',
        disconnectTitle: ({ service }: { service: string }) => `Disconnect ${service}?`,
        disconnectMessage: ({ service, computer }: { service: string; computer: string }) => `New agents on ${computer} will no longer be able to use ${service}.`,
        disconnectFailedTitle: 'Could not disconnect',
        disconnectFailedMessage: ({ service, computer }: { service: string; computer: string }) => `${service} is still connected on ${computer}.`,
        howTitle: 'Connecting a service',
        howRow: 'Set it up on the computer',
        howHint: 'Open the service\u2019s sign-in on the computer that will use it. The sign-in is stored there, in that computer\u2019s credential store, and only the record of it appears on this page.',
        unknownComputer: 'A computer no longer on this account',
    },
    addComputer: {
        otherComputer: 'On the other computer',
        otherComputerRow: 'Open this app and choose to join an account',
        otherComputerHint: 'It will show a one-time code and wait.',
        codeTitle: 'Code from the other computer',
        codeFooter: 'The code works once. If it stops working, let the other computer show a new one.',
        codePlaceholder: 'Paste the code here',
        adding: 'Adding the computer\u2026',
        add: 'Add this computer',
        badCodeTitle: 'That code does not look right',
        badCodeMessage: 'Copy the code exactly as the other computer shows it, then paste it here.',
        scanFooter: 'Phones can read the code from the other computer\u2019s screen instead of typing it.',
        scan: 'Scan the code instead',
        whatTitle: 'What this does',
        whatRow: 'The other computer joins this account',
        whatHint: 'It can then run agents for you, and it appears in the list of computers on the account page. Remove it there whenever you want.',
    },

    tabs: {
        // Tab navigation labels
        inbox: 'Inbox',
        agents: 'Agents',
        settings: 'Account',
    },


    common: {
        // Simple string constants
        cancel: 'Cancel',
        authenticate: 'Authenticate',
        save: 'Save',
        saveAs: 'Save As',
        error: 'Error',
        success: 'Success',
        ok: 'OK',
        continue: 'Continue',
        back: 'Back',
        create: 'Create',
        rename: 'Rename',
        reset: 'Reset',
        logout: 'Logout',
        yes: 'Yes',
        no: 'No',
        discard: 'Discard',
        version: 'Version',
        copied: 'Copied',
        copy: 'Copy',
        scanning: 'Scanning...',
        urlPlaceholder: 'https://example.com',
        home: 'Home',
        message: 'Message',
        files: 'Files',
        fileViewer: 'File Viewer',
        loading: 'Loading...',
        retry: 'Retry',
        delete: 'Delete',
        optional: 'optional',
    },

    profile: {
        userProfile: 'User Profile',
        details: 'Details',
        firstName: 'First Name',
        lastName: 'Last Name',
        username: 'Username',
        status: 'Status',
    },

    status: {
        connected: 'connected',
        connecting: 'connecting',
        disconnected: 'disconnected',
        error: 'error',
        online: 'online',
        offline: 'offline',
        lastSeen: ({ time }: { time: string }) => `last seen ${time}`,
        permissionRequired: 'permission required',
        inputRequired: 'waiting for your answer',
        activeNow: 'Active now',
        unknown: 'unknown',
        unread: 'new results',
    },

    time: {
        justNow: 'just now',
        minutesAgo: ({ count }: { count: number }) => `${count} minute${count !== 1 ? 's' : ''} ago`,
        hoursAgo: ({ count }: { count: number }) => `${count} hour${count !== 1 ? 's' : ''} ago`,
        daysAgo: ({ count }: { count: number }) => `${count} day${count !== 1 ? 's' : ''} ago`,
    },

    connect: {
        restoreAccount: 'Restore Account',
        enterSecretKey: 'Please enter a secret key',
        invalidSecretKey: 'Invalid secret key. Please check and try again.',
        enterUrlManually: 'Enter URL manually',
    },

    settings: {
        title: 'Account',
        connectedAccounts: 'Connected Accounts',
        connectAccount: 'Connect account',
        github: 'GitHub',
        machines: 'Machines',
        showOfflineMachines: ({ count }: { count: number }) => count === 1 ? 'Show 1 offline machine' : `Show ${count} offline machines`,
        hideOfflineMachines: 'Hide offline machines',
        features: 'Features',
        social: 'Social',
        account: 'Account',
        accountSubtitle: 'Manage your account details',
        appearance: 'Appearance',
        appearanceSubtitle: 'Customize how the app looks',
        voiceAssistant: 'Voice Assistant',
        voiceAssistantSubtitle: 'Configure voice interaction preferences',
        featuresTitle: 'Features',
        featuresSubtitle: 'Enable or disable app features',
        developer: 'Developer',
        developerTools: 'Developer Tools',
        about: 'About',
        whatsNew: 'What\'s New',
        whatsNewSubtitle: 'See the latest updates and improvements',
        reportIssue: 'Report an Issue',
        privacyPolicy: 'Privacy Policy',
        termsOfService: 'Terms of Service',
        eula: 'EULA',
        supportUs: 'Support us',
        supportUsSubtitlePro: 'Thank you for your support!',
        supportUsSubtitle: 'Support project development',
        scanQrCodeToAuthenticate: 'Scan QR code to authenticate',
        githubConnected: ({ login }: { login: string }) => `Connected as @${login}`,
        connectGithubAccount: 'Connect your GitHub account',
        claudeAuthSuccess: 'Successfully connected to Claude',
        exchangingTokens: 'Exchanging tokens...',
        usage: 'Usage',
        usageSubtitle: 'View your API usage and costs',
        // Dynamic settings messages
        accountConnected: ({ service }: { service: string }) => `${service} account connected`,
        machineStatus: ({ name, status }: { name: string; status: 'online' | 'offline' }) =>
            `${name} is ${status}`,
        featureToggled: ({ feature, enabled }: { feature: string; enabled: boolean }) =>
            `${feature} ${enabled ? 'enabled' : 'disabled'}`,
    },

    settingsAppearance: {
        // Appearance settings screen
        theme: 'Theme',
        themeDescription: 'Choose your preferred color scheme',
        themeOptions: {
            adaptive: 'Adaptive',
            light: 'Light', 
            dark: 'Dark',
        },
        themeDescriptions: {
            adaptive: 'Match system settings',
            light: 'Always use light theme',
            dark: 'Always use dark theme',
        },
        chat: 'Chat',
        chatDescription: 'Customize chat message appearance',
        userMessageBubbleColor: 'User Bubble Color',
        userMessageBubbleColorDescription: 'Make your messages easier to spot in long chats',
        userMessageBubbleColorOptions: {
            blue: 'Blue',
            green: 'Green',
            purple: 'Purple',
            rose: 'Rose',
            sand: 'Sand',
            gray: 'Gray',
        },
        display: 'Display',
        displayDescription: 'Control layout and spacing',
        showLineNumbersInToolViews: 'Show Line Numbers in Tool Views',
        showLineNumbersInToolViewsDescription: 'Display line numbers in tool view diffs',
    },

    sessionsFilter: {
        // Filter menu on the home sessions list header
        title: 'Filter',
        groupingTitle: 'Grouping',
        flatList: 'Flat List',
        groupByProject: 'Group by Project',
        appearanceSettings: 'Appearance Settings',
    },

    settingsFeatures: {
        // Features settings screen
        experiments: 'Experimental',
        experimentsDescription: 'Enable experimental features that are still in development. These features may be unstable or change without notice.',
        experimentalFeatures: 'Experimental Features',
        experimentalFeaturesEnabled: 'Experimental features enabled',
        experimentalFeaturesDisabled: 'Using stable features only',
        webFeatures: 'Web Features',
        webFeaturesDescription: 'Features available only in the web version of the app.',
        commandPalette: 'Command Palette',
        markdownCopyV2: 'Markdown Copy v2',
        markdownCopyV2Subtitle: 'Long press opens copy modal',
        groupToolCalls: 'Group Tool Calls',
        groupToolCallsSubtitle: 'Collapse consecutive tool calls into one container',
    },

    imageUpload: {
        permissionTitle: 'Photo Library Access',
        permissionMessage: 'Allow access to your photo library to attach images to messages.',
        limitTitle: 'Image Limit Reached',
        limitMessage: ({ max }: { max: number }) => `You can attach up to ${max} images per message.`,
        fileTooLargeTitle: 'File Too Large',
        fileTooLargeMessage: ({ name, maxMb }: { name: string; maxMb: number }) => `"${name}" exceeds the ${maxMb}MB limit and was not added.`,
        uploadFailedTitle: 'Upload Failed',
        uploadFailedMessage: ({ count }: { count: number }) => count === 1
            ? 'One image could not be uploaded and was not sent.'
            : `${count} images could not be uploaded and were not sent.`,
        notSupportedTitle: 'Images Not Supported',
        notSupportedMessage: 'This agent does not support image attachments. Images were not sent.',
    },

    errors: {
        networkError: 'Network error occurred',
        serverError: 'Server error occurred',
        unknownError: 'An unknown error occurred',
        connectionTimeout: 'Connection timed out',
        authenticationFailed: 'Authentication failed',
        permissionDenied: 'Permission denied',
        fileNotFound: 'File not found',
        invalidFormat: 'Invalid format',
        operationFailed: 'Operation failed',
        tryAgain: 'Please try again',
        contactSupport: 'Contact support if the problem persists',
        sessionNotFound: 'Session not found',
        voiceSessionFailed: 'Failed to start voice session',
        voiceServiceUnavailable: 'Voice service is temporarily unavailable',
        voiceLimitReachedTitle: 'Voice Limit Reached',
        voiceHardLimitReached: ({ hours }: { hours: number }) => `You've used ${hours}+ hours of voice this month. This is the maximum allowed. You can configure your own ElevenLabs agent in Voice settings to use your own quota.`,
        voiceConversationLimitReached: 'You\'ve reached the maximum number of voice conversations this month. We may add on-demand voice usage in the future — please file an issue at github.com/nicepkg/happy/issues if you hit this limit.',
        oauthInitializationFailed: 'Failed to initialize OAuth flow',
        tokenStorageFailed: 'Failed to store authentication tokens',
        oauthStateMismatch: 'Security validation failed. Please try again',
        tokenExchangeFailed: 'Failed to exchange authorization code',
        oauthAuthorizationDenied: 'Authorization was denied',
        webViewLoadFailed: 'Failed to load authentication page',
        failedToLoadProfile: 'Failed to load user profile',
        userNotFound: 'User not found',
        sessionDeleted: 'Agent has been deleted',
        sessionDeletedDescription: 'This agent has been permanently removed',
        fieldError: ({ field, reason }: { field: string; reason: string }) =>
            `${field}: ${reason}`,
        validationError: ({ field, min, max }: { field: string; min: number; max: number }) =>
            `${field} must be between ${min} and ${max}`,
        retryIn: ({ seconds }: { seconds: number }) =>
            `Retry in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`,
        errorWithCode: ({ message, code }: { message: string; code: number | string }) =>
            `${message} (Error ${code})`,
        disconnectServiceFailed: ({ service }: { service: string }) => 
            `Failed to disconnect ${service}`,
        connectServiceFailed: ({ service }: { service: string }) =>
            `Failed to connect ${service}. Please try again.`,
        failedToLoadFriends: 'Failed to load friends list',
        failedToAcceptRequest: 'Failed to accept friend request',
        failedToRejectRequest: 'Failed to reject friend request',
        failedToRemoveFriend: 'Failed to remove friend',
        searchFailed: 'Search failed. Please try again.',
        failedToSendRequest: 'Failed to send friend request',
    },

    newSession: {
        title: 'New agent',
        machineOffline: 'This computer is offline',
        switchMachinesHint: '• Switch machines by clicking on the machine above',
    },

    sessionHistory: {
        // Used by session history screen
        title: 'Agent history',
        empty: 'No agents found',
        today: 'Today',
        yesterday: 'Yesterday',
        daysAgo: ({ count }: { count: number }) => `${count} ${count === 1 ? 'day' : 'days'} ago`,
        viewAll: 'View all agents',
    },

    session: {
        inputPlaceholder: 'Type a message ...',
        inactiveArchived: 'This agent is not running.',
        resumeFromTerminal: 'To resume it from the terminal:',
        statusBarContext: 'Context',
        statusBarPathTitle: 'Working directory',
        // Fork / duplicate / rewind flow (Claude only)
        forkAction: 'Fork session',
        forkSubtitle: 'Continue in a new session with the same context',
        duplicateAction: 'Duplicate from message…',
        duplicateSubtitle: 'Rewind to a chosen point and try again',
        forkFromHere: 'Fork from here',
        duplicateSheetTitle: 'Choose a rewind point',
        duplicateSheetSubtitle: 'The new session keeps the chosen turn complete (your message and the agent’s response) and drops every prompt after it.',
        duplicateSheetConfirm: 'Duplicate',
        duplicateSheetEmpty: 'No messages eligible for rewind in this session yet.',
        duplicateRowDisabled: "This message can't be used as a rewind point.",
        forkedFromLabel: 'Forked from',
        forkedFromSubtitle: 'Open the agent this fork came from',
        forkErrorOffline: 'This machine is offline. Fork is only available while the machine that owns the session is online.',
        forkErrorMissingUuid: 'The chosen rewind point is no longer present in the source session — try forking without truncation.',
        forkErrorMissingMetadata: 'Missing session metadata required to fork.',
        forkErrorGeneric: 'Failed to fork the session.',
        forkClaudeOnly: 'Fork is currently only supported for Claude sessions.',
        newAgent: 'New agent',
        agentInDirectory: ({ profile, directory }: { profile: string; directory: string }) => `${profile} in ${directory}`,
    },

    commandPalette: {
        placeholder: 'Type a command or search...',
    },

    relay: {
        // Used by the relay address entry (components/RelayAddressEntry.tsx)
        title: 'Relay',
        firstRunTitle: 'Name your relay',
        firstRunBody: 'This app reaches your computers through a relay you run. There is no default one, so enter its address to continue.',
        addressLabel: 'Relay address',
        addressPlaceholder: 'https://relay.example.com',
        addressEmpty: 'Enter a relay address',
        addressProtocol: 'The address has to start with http:// or https://',
        addressFormat: 'That is not a valid address',
        checking: 'Checking the relay...',
        checkingShort: 'Checking...',
        notARelay: 'Nothing answered as a relay at that address',
        unreachable: 'Could not reach that address',
        returnedError: 'The relay returned an error',
        current: 'This computer reaches the relay above',
        changeTitle: 'Change relay',
        changeBody: 'Your account lives on the relay you leave, so you have to log in again on the new one. Continue?',
        forget: 'Forget relay',
        forgetTitle: 'Forget this relay',
        forgetBody: 'The app asks for an address again and stays logged out until you give it one.',
        footer: 'Agents run on your computers; the relay only passes encrypted messages between them and this app. Changing it signs you out.',
    },

    sessionInfo: {
        title: 'Agent details',
        // Used by Session Info screen (app/(app)/session/[id]/info.tsx)
        killSession: 'Kill Session',
        killSessionConfirm: 'Are you sure you want to terminate this session?',
        archiveSession: 'Archive agent',
        archiveSessionConfirm: 'Are you sure you want to archive this session?',
        agentIdCopied: 'Agent ID copied to clipboard',
        failedToCopyAgentId: 'Failed to copy the agent ID',
        agentId: 'Agent ID',
        engineSessionId: 'Engine session ID',
        engineSessionIdCopied: 'Engine session ID copied to clipboard',
        codexThreadId: 'Codex Thread ID',
        codexThreadIdCopied: 'Codex Thread ID copied to clipboard',
        failedToCopyEngineSessionId: 'Failed to copy the engine session ID',
        failedToCopyCodexThreadId: 'Failed to copy Codex Thread ID',
        metadataCopied: 'Agent details copied to clipboard',
        failedToCopyMetadata: 'Failed to copy the agent details',
        failedToKillSession: 'Failed to kill session',
        failedToArchiveSession: 'Failed to archive the agent',
        connectionStatus: 'Connection Status',
        created: 'Created',
        lastUpdated: 'Last Updated',
        sequence: 'Sequence',
        quickActions: 'Quick Actions',
        viewMachine: 'View Machine',
        viewMachineSubtitle: 'Open this computer and its agents',
        viewChanges: 'View changes',
        viewChangesSubtitle: 'Diffs for every uncommitted file',
        resumeSession: 'Resume Session',
        resumeSessionSubtitle: 'Resume this session on the same machine',
        resumeSessionSameMachineOnly: 'This session can only be resumed on the same machine it started on.',
        resumeSessionMachineOffline: 'This machine is offline. Resume is only available while it is online.',
        resumeSessionMissingMachine: 'This session is missing its machine metadata, so it cannot be resumed.',
        resumeSessionMissingBackendId: 'This session does not have a resumable Claude or Codex identifier.',
        resumeSessionUnexpectedDirectoryPrompt: 'Resume cannot create directories. Start the session manually from its original path.',
        killSessionSubtitle: 'Immediately terminate the session',
        archiveSessionSubtitle: 'Archive this agent and stop it',
        metadata: 'Metadata',
        host: 'Host',
        path: 'Path',
        operatingSystem: 'Operating System',
        processId: 'Process ID',
        happyHome: 'Happy Home',
        copyMetadata: 'Copy agent details',
        agentState: 'Agent State',
        controlledByUser: 'Controlled by User',
        pendingRequests: 'Pending Requests',
        activity: 'Activity',
        thinking: 'Thinking',
        thinkingSince: 'Thinking Since',
        cliVersion: 'CLI Version',
        cliVersionOutdated: 'CLI Update Required',
        cliVersionOutdatedMessage: ({ currentVersion, requiredVersion }: { currentVersion: string; requiredVersion: string }) =>
            `Version ${currentVersion} installed. Update to ${requiredVersion} or later`,
        updateCliInstructions: 'Please run npm install -g happy@latest',
        deleteSession: 'Delete agent',
        deleteSessionSubtitle: 'Permanently remove this agent',
        deleteSessionConfirm: 'Delete Session Permanently?',
        deleteSessionWarning: 'This cannot be undone. Every message and everything this agent recorded is deleted for good.',
        failedToDeleteSession: 'Failed to delete the agent',
        sessionDeleted: 'Session deleted successfully',
        worktreeCleanupTitle: 'Delete Worktree?',
        worktreeCleanupMessage: 'The worktree has no uncommitted changes. Would you like to delete the worktree files?',
        worktreeCleanupDelete: 'Delete Worktree',
        worktreeCleanupKeep: 'Keep Files',
        
    },

    components: {
        agentGoalBar: {
            currentGoal: 'Current goal',
            accessibilityLabel: ({ goal }: { goal: string }) => `Current goal: ${goal}`,
            clearGoal: 'Clear goal',
            stopGoal: 'Stop goal',
            editGoal: 'Edit goal',
        },
    },

    agentInput: {
        permissionMode: {
            // Modes are named with one untranslated word so they fit the
            // composer chip; these strings describe them under that name.
            title: 'PERMISSION MODE',
            // Not "never asks": auto still stops for a human, it just decides
            // for itself when that is warranted.
            auto: 'asks when unsure',
            // Default sends no mode at all, so naming a behaviour here would be
            // a guess about someone else's config.
            default: 'harness setting',
            agyDefault: 'agy sandbox',
            openclawInert: 'not applied',
            acceptEdits: 'edits, no asking',
            plan: 'plan first',
            dontAsk: "don't ask",
            bypassPermissions: 'never asks',
            badgeAcceptAllEdits: 'accept all edits',
            badgeBypassAllPermissions: 'yolo',
            badgePlanMode: 'plan mode',
        },
        agent: {
            claude: 'Claude',
            codex: 'Codex',
            gemini: 'Gemini',
            openclaw: 'OpenClaw',
        },
        model: {
            title: 'MODEL',
            configureInCli: 'Configure models in CLI settings',
        },
        effort: {
            title: 'EFFORT',
        },
        codexPermissionMode: {
            title: 'CODEX PERMISSION MODE',
            default: 'default permissions',
            readOnly: 'read-only',
            safeYolo: 'safe yolo',
            yolo: 'yolo',
            defaultDescription: 'codex setting',
            // Codex's own Auto preset: on-request approvals inside the
            // workspace sandbox.
            autoDescription: 'asks when unsure',
            readOnlyDescription: 'no writes',
            // Not "no prompts": shouldAutoApproveCodexApproval deliberately
            // skips safe-yolo, so a sandbox escalation still reaches you.
            safeYoloDescription: 'sandboxed, can escalate',
            yoloDescription: 'full access',
            badgeReadOnly: 'read-only',
            badgeSafeYolo: 'safe yolo',
            badgeYolo: 'yolo',
        },
        codexModel: {
            title: 'CODEX MODEL',
            gpt5CodexLow: 'gpt-5-codex low',
            gpt5CodexMedium: 'gpt-5-codex medium',
            gpt5CodexHigh: 'gpt-5-codex high',
            gpt5Minimal: 'GPT-5 Minimal',
            gpt5Low: 'GPT-5 Low',
            gpt5Medium: 'GPT-5 Medium',
            gpt5High: 'GPT-5 High',
        },
        geminiPermissionMode: {
            title: 'GEMINI PERMISSION MODE',
            default: 'ask before every tool',
            autoEdit: 'accept file edits',
            yolo: 'never ask, full access',
            plan: 'read only, plan first',
            badgeAutoEdit: 'auto edit',
            badgeYolo: 'yolo',
            badgePlan: 'plan',
        },
        context: {
            detailContext: ({ used, total }: { used: string; total: string }) => `${used} / ${total} context`,
            percentContext: ({ percent }: { percent: number }) => `${percent}% context`,
            percentWeek: ({ percent }: { percent: number }) => `${percent}% week`,
        },
        usagePopup: {
            session: 'Session',
            week: 'Week',
            resets: ({ time }: { time: string }) => `Resets ${time}`,
        },
        suggestion: {
            fileLabel: 'FILE',
            folderLabel: 'FOLDER',
        },
        noMachinesAvailable: 'No machines',
    },

    machineLauncher: {
        showLess: 'Show less',
        showAll: ({ count }: { count: number }) => `Show all (${count} paths)`,
        enterCustomPath: 'Enter custom path',
        offlineUnableToSpawn: 'Cannot start an agent while this computer is offline',
    },

    agentQuestion: {
        title: 'Question',
        submit: 'Send answer',
        chooseMultiple: 'Choose as many as apply',
        ownAnswer: 'Your own answer',
        ownAnswerPlaceholder: 'Write an answer instead',
        submitFailed: 'Could not send your answer',
        dismiss: 'Dismiss',
        unsupportedTitle: 'Unsupported request',
        unsupportedDescription: ({ kind }: { kind: string }) =>
            `This version of Happy cannot show a "${kind}" request. Update the app to respond.`,
        moreQuestions: ({ count }: { count: number }) =>
            count === 1 ? '1 more question' : `${count} more questions`,
    },

    sidebar: {
        agentsTitle: 'Agents',
        showArchived: 'Show archived',
        hideArchived: 'Hide archived',
        newAgent: 'New agent',
        projects: 'Projects',
    },

    zen: {
        toggle: 'Zen mode',
    },


    toolGroup: {
        // Labels for single-tool activity rows; the detail follows inline
        // ("Ran: git status"), so they carry no counts.
        ran: 'Ran',
        edited: 'Edited',
        read: 'Read',
        searched: 'Searched',
        fetched: 'Fetched',
        ranTask: 'Ran task',
        workedFor: ({ duration }: { duration: string }) => `Worked ${duration}`,
        hide: 'Hide',
    },


    files: {
        changes: 'Changes',
        searchPlaceholder: 'Search files...',
        detachedHead: 'detached HEAD',
        summary: ({ staged, unstaged }: { staged: number; unstaged: number }) => `${staged} staged • ${unstaged} unstaged`,
        notRepo: 'Not a git repository',
        notUnderGit: 'This directory is not under git version control',
        searching: 'Searching files...',
        noFilesFound: 'No files found',
        noFilesInProject: 'No files in project',
        tryDifferentTerm: 'Try a different search term',
        searchResults: ({ count }: { count: number }) => `Search Results (${count})`,
        projectRoot: 'Project root',
        stagedChanges: ({ count }: { count: number }) => `Staged Changes (${count})`,
        unstagedChanges: ({ count }: { count: number }) => `Unstaged Changes (${count})`,
        // File viewer strings
        loadingFile: ({ fileName }: { fileName: string }) => `Loading ${fileName}...`,
        binaryFile: 'Binary File',
        cannotDisplayBinary: 'Cannot display binary file content',
        diff: 'Diff',
        file: 'File',
        fileEmpty: 'File is empty',
        noChanges: 'No changes to display',
        noChangesTitle: 'No changes',
        noChangesSubtitle: 'Working tree is clean',
        deleted: 'Deleted',
        changedFiles: ({ count }: { count: number }) => `${count} changed ${count === 1 ? 'file' : 'files'}`,
        allFiles: 'All Files',
        addPanel: 'Add panel',
        closePanel: 'Close panel',
        editFile: 'Edit',
        saveFile: 'Save',
        failedToRead: 'Failed to read file',
        failedToSave: 'Failed to save file',
        fileConflict: 'File conflict',
        fileConflictDescription: 'This file was modified on the device while you were editing. Reload to see the latest version.',
        reload: 'Reload',
        overwrite: 'Overwrite',
    },
    diff: {
        showMoreLines: ({ count }: { count: number }) => `Show ${count} more lines`,
        tapToExpand: ({ count }: { count: number }) => `${count} changed lines — tap to expand`,
        ignoreWhitespace: 'Ignore whitespace',
        imageBefore: 'Before',
        imageAfter: 'After',
        unchangedLines: ({ count }: { count: number }) => `${count} unchanged`,
        noChanges: 'No changes',
        binaryFile: 'Binary file not shown',
    },


    settingsAccount: {
        // Account settings screen
        accountInformation: 'Account Information',
        status: 'Status',
        statusActive: 'Active',
        statusNotAuthenticated: 'Not Authenticated',
        anonymousId: 'Anonymous ID',
        publicId: 'Public ID',
        notAvailable: 'Not available',
        linkNewDevice: 'Link New Device',
        linkNewDeviceSubtitle: 'Scan QR code to link device',
        profile: 'Profile',
        name: 'Name',
        github: 'GitHub',
        tapToDisconnect: 'Tap to disconnect',
        backup: 'Backup',
        backupDescription: 'Your secret key is the only way to recover your account. Save it in a secure place like a password manager.',
        secretKey: 'Secret Key',
        tapToReveal: 'Tap to reveal',
        tapToHide: 'Tap to hide',
        secretKeyLabel: 'SECRET KEY (TAP TO COPY)',
        secretKeyCopied: 'Secret key copied to clipboard. Store it in a safe place!',
        secretKeyCopyFailed: 'Failed to copy secret key',
        privacy: 'Privacy',
        privacyDescription: 'Help improve the app by sharing anonymous usage data. No personal information is collected.',
        analytics: 'Analytics',
        analyticsDisabled: 'No data is shared',
        analyticsEnabled: 'Anonymous usage data is shared',
        dangerZone: 'Danger Zone',
        logout: 'Logout',
        logoutSubtitle: 'Sign out and clear local data',
        logoutConfirm: 'Are you sure you want to logout? Make sure you have backed up your secret key!',
    },

    settingsLanguage: {
        // Language settings screen
        title: 'Language',
        description: 'Choose your preferred language for the app interface. This will sync across all your devices.',
        currentLanguage: 'Current Language',
        automatic: 'Automatic',
        automaticSubtitle: 'Detect from device settings',
        needsRestart: 'Language Changed',
        needsRestartMessage: 'The app needs to restart to apply the new language setting.',
        restartNow: 'Restart Now',
    },

    connectButton: {
        authenticate: 'Authenticate Terminal',
        authenticateWithUrlPaste: 'Authenticate Terminal with URL paste',
        pasteAuthUrl: 'Paste the auth URL from your terminal',
    },

    updateBanner: {
        updateAvailable: 'Update available',
        pressToApply: 'Press to apply the update',
        whatsNew: "What's new",
        seeLatest: 'See the latest updates and improvements',
        nativeUpdateAvailable: 'App Update Available',
        tapToUpdateAppStore: 'Tap to update in App Store',
        tapToUpdatePlayStore: 'Tap to update in Play Store',
    },

    changelog: {
        // Used by the changelog screen
        version: ({ version }: { version: number }) => `Version ${version}`,
        noEntriesAvailable: 'No changelog entries available.',
    },

    terminal: {
        // Used by terminal connection screens
        webBrowserRequired: 'Web Browser Required',
        webBrowserRequiredDescription: 'Terminal connection links can only be opened in a web browser for security reasons. Please use the QR code scanner or open this link on a computer.',
        processingConnection: 'Processing connection...',
        invalidConnectionLink: 'Invalid Connection Link',
        invalidConnectionLinkDescription: 'The connection link is missing or invalid. Please check the URL and try again.',
        connectTerminal: 'Connect Terminal',
        terminalRequestDescription: 'A terminal is requesting to connect to your Happy Coder account. This will allow the terminal to send and receive messages securely.',
        connectionDetails: 'Connection Details',
        publicKey: 'Public Key',
        encryption: 'Encryption',
        endToEndEncrypted: 'End-to-end encrypted',
        acceptConnection: 'Accept Connection',
        connecting: 'Connecting...',
        reject: 'Reject',
        security: 'Security',
        securityFooter: 'This connection link was processed securely in your browser and was never sent to any server. Your private data will remain secure and only you can decrypt the messages.',
        securityFooterDevice: 'This connection was processed securely on your device and was never sent to any server. Your private data will remain secure and only you can decrypt the messages.',
        clientSideProcessing: 'Client-Side Processing',
        linkProcessedLocally: 'Link processed locally in browser',
        linkProcessedOnDevice: 'Link processed locally on device',
    },

    modals: {
        // Used across connect flows and settings
        authenticateTerminal: 'Authenticate Terminal',
        pasteUrlFromTerminal: 'Paste the authentication URL from your terminal',
        deviceLinkedSuccessfully: 'Device linked successfully',
        terminalConnectedSuccessfully: 'Terminal connected successfully',
        invalidAuthUrl: 'Invalid authentication URL',
        developerMode: 'Developer Mode',
        developerModeEnabled: 'Developer mode enabled',
        developerModeDisabled: 'Developer mode disabled',
        disconnectGithub: 'Disconnect GitHub',
        disconnectGithubConfirm: 'Are you sure you want to disconnect your GitHub account?',
        disconnectService: ({ service }: { service: string }) => 
            `Disconnect ${service}`,
        disconnectServiceConfirm: ({ service }: { service: string }) => 
            `Are you sure you want to disconnect ${service} from your account?`,
        disconnect: 'Disconnect',
        failedToConnectTerminal: 'Failed to connect terminal',
        cameraPermissionsRequiredToConnectTerminal: 'Camera permissions are required to connect terminal',
        failedToLinkDevice: 'Failed to link device',
        cameraPermissionsRequiredToScanQr: 'Camera permissions are required to scan QR codes'
    },

    navigation: {
        // Navigation titles and screen headers
        connectTerminal: 'Connect Terminal',
        linkNewDevice: 'Link New Device', 
        restoreWithSecretKey: 'Restore with Secret Key',
        whatsNew: "What's New",
        friends: 'Friends',
    },

    welcome: {
        // Main welcome screen for unauthenticated users
        title: 'An agent that works your computer',
        subtitle: 'End-to-end encrypted and your account is stored only on your device.',
        createAccount: 'Create account',
        linkOrRestoreAccount: 'Link or restore account',
        loginWithMobileApp: 'Log in from another computer',
    },

    review: {
        // Used by utils/requestReview.ts
        enjoyingApp: 'Enjoying the app?',
        feedbackPrompt: "We'd love to hear your feedback!",
        yesILoveIt: 'Yes, I love it!',
        notReally: 'Not really'
    },

    items: {
        // Used by Item component for copy toast
        copiedToClipboard: ({ label }: { label: string }) => `${label} copied to clipboard`
    },

    machine: {
        back: 'Back',
        notFound: 'This computer is not on your account',
        unnamed: 'Unnamed computer',
        connected: 'Connected',
        offline: 'Offline',
        offlineHint: 'Open this app on that computer to bring it back.',
        offlineHelp: '• Wake the computer and check its internet connection\n• Open this app on that computer again\n• Then come back here',
        renameTitle: 'Rename this computer',
        renameMessage: 'Give this computer a name you will recognise. Leave it empty to use its own name.',
        renamePlaceholder: 'Name this computer',
        renameFailed: 'Could not rename this computer.',
        confirmationTitle: 'Confirmation',
        confirmationRow: 'Ask before risky steps',
        confirmationFooter: 'While this is on, the agent stops and asks before deleting or overwriting your files, reaching outside the folders you allowed, sending anything out, paying, or installing software. While it is off, it works without asking. Reading sensitive files is refused either way.',
        confirmationFooterOffline: 'Turn this computer on to change the setting.',
        confirmationUnreported: ({ reason }: { reason: string }) => `This computer did not report the setting: ${reason}`,
        confirmationNoAnswer: 'This computer did not answer.',
        confirmationUnknown: 'Not reported by this computer',
        confirmationOn: 'On for this computer',
        confirmationOff: 'Off for this computer',
        confirmationOnLastSeen: 'On when this computer was last seen',
        confirmationOffLastSeen: 'Off when this computer was last seen',
        recentAgents: 'Recent agents',
        newAgentHere: 'New agent here',
        newAgentHereSubtitle: 'Start an agent on this computer',
        newAgentOffline: 'This computer is offline, so it cannot start an agent',
        details: 'Details',
        detailsHint: 'Only needed when something looks wrong',
        host: 'Host',
        platform: 'Platform',
        cliAvailability: 'Agent program',
        cliInstalled: 'Installed',
        cliNotFound: 'Not found',
        lastDetected: 'Last checked',
        lastKnownPid: 'Last known process id',
        lastKnownHttpPort: 'Last known port',
        daemonStateVersion: 'Background service version',
        delete: 'Remove this computer',
        deleteFooter: 'Removes this computer from your account. The agents that ran on it stay readable, but none can be started on it again until it joins the account anew.',
        deleteConfirmTitle: 'Remove this computer?',
        deleteConfirmMessage: 'It will be removed from your account. The agents that ran on it stay readable, but no new agent can start on it until it joins again.',
        deleteFailed: 'Could not remove this computer.',
    },

    message: {
        switchedToMode: ({ mode }: { mode: string }) => `Switched to ${mode} mode`,
        unknownEvent: 'Unknown event',
        usageLimitUntil: ({ time }: { time: string }) => `Usage limit reached until ${time}`,
        sentAsGoal: 'Sent as goal',
        unknownTime: 'unknown time',
    },

    textSelection: {
        // Text selection screen
        selectText: 'Select text range',
        title: 'Select Text',
        noTextProvided: 'No text provided',
        textNotFound: 'Text not found or expired',
        textCopied: 'Text copied to clipboard',
        failedToCopy: 'Failed to copy text to clipboard',
        noTextToCopy: 'No text available to copy',
    },

    markdown: {
        // Markdown copy functionality
        codeCopied: 'Code copied',
        copyFailed: 'Copy failed',
        mermaidRenderFailed: 'Failed to render mermaid diagram',
    },





    harness: {
        stateRunning: 'running',
        stateIdle: 'idle',
        stateWaiting: 'waiting for your answer',
        stateArchived: 'archived',
        usedTool: 'used a tool',
        profileLabel: 'Profile',
        profileDefault: 'Default',
        profileDefaultHint: 'everything switched on',
        profilePlan: 'Plan',
        profilePlanHint: 'thinks it through before changing anything',
        profileBuild: 'Build',
        profileBuildHint: 'writes code and runs commands',
        extraInstructions: 'Extra instructions',
        extraInstructionsPlaceholder: 'Anything this agent should always keep in mind',
        noAgentsTitle: 'No agents yet',
        searchAgents: "Search agents",
        clearSearch: "Clear the search",
        noAgentsDescription: "Start one on a computer you have connected.",
        noComputersTitle: "No computers connected",
        noComputersDescription: "Install the app on the computer you want your agents to work on.",
        computerUnreachableTitle: "No computer is reachable",
        computerUnreachableDescription: "Bring a computer online to start an agent.",
        troubleshoot: "Troubleshoot",
        emptyTranscriptTitle: "Nothing here yet",
        emptyTranscriptDescription: "Describe the task and this agent gets to work.",
        troubleshootTitle: 'Troubleshoot the connection',
        troubleshootCopy: 'Copy AI prompt',
        troubleshootCopyFailed: 'Could not copy the AI prompt.',
        troubleshootStep1: '1. Wake the computer and check its internet connection.',
        troubleshootStep2: '2. Open this app on that computer again.',
        troubleshootStep3: '3. Then come back here.',
        troubleshootPromptLabel: 'AI prompt:',
    },

    // DESK-20: the transcript's own rows — a thinking block and the raw call behind
    // an activity line.
    transcript: {
        thinking: 'Thinking',
        thoughtFor: ({ duration }: { duration: string }) => `Thought for ${duration}`,
        showThinking: 'Show what it was thinking',
        hideThinking: 'Hide what it was thinking',
        showRawCall: 'Show the details',
        hideRawCall: 'Hide the details',
    },

    permissionRequest: {
        allowOnce: "Allow once",
        allowAlways: "Always allow",
        deny: "Don't allow",
        runCommand: "Run a command",
        readFile: "Read a file",
        createFile: "Create a file",
        changeFile: "Change a file",
        searchFiles: "Look through files",
        fetchWeb: "Open a page on the web",
        searchWeb: "Search the web",
        startHelper: "Start a helper agent",
        startChanges: "Start making changes",
        useTool: "Use a tool",
        scopeFolder: "Inside the folder it works in",
        scopeComputer: "On this computer",
        scopeWeb: "Outside this computer",
        answeredAllowed: "You allowed this.",
        answeredDenied: "You didn't allow this.",
    },

} as const;

export type Translations = typeof en;

/**
 * Generic translation type that matches the structure of Translations
 * but allows different string values (for other languages)
 */
export type TranslationStructure = {
    readonly [K in keyof Translations]: {
        readonly [P in keyof Translations[K]]: Translations[K][P] extends string 
            ? string 
            : Translations[K][P] extends (...args: any[]) => string 
                ? Translations[K][P] 
                : Translations[K][P] extends object
                    ? {
                        readonly [Q in keyof Translations[K][P]]: Translations[K][P][Q] extends string
                            ? string
                            : Translations[K][P][Q]
                      }
                    : Translations[K][P]
    }
};
