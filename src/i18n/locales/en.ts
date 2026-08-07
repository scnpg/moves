// Source-of-truth dictionary - es.ts and zh-Hant.ts are typed against this
// shape (see TranslationKey in ../index.tsx), so a missing/extra key in
// either of those is a compile error, not a silent runtime fallback.
const en = {
  nav: {
    moves: 'Moves',
    search: 'Search',
    profile: 'Profile',
  },
  auth: {
    signIn: 'Sign in',
    email: 'Email',
    phone: 'Phone',
    password: 'Password',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    newHere: "New here?",
    createAccount: 'Create an account',
    createYourAccount: 'Create your account',
    alreadyHaveAccount: 'Already have an account?',
    username: 'Username',
    usernamePlaceholder: 'Ex. white_monster',
    usernameHelp: '3-20 characters: lowercase letters, numbers, underscores.',
    displayName: 'Display name',
    displayNamePlaceholder: 'Ex. David D.',
    passwordMinPlaceholder: 'At least 6 characters',
    signUp: 'Create account',
    checkEmailTitle: 'Check your email',
    checkEmailMessage: 'Confirm your address, then sign in.',
    signUpFailed: 'Sign up failed',
    signInFailed: 'Sign in failed',
    pleaseTryAgain: 'Please try again.',
  },
  profile: {
    title: 'Profile',
    edit: 'Edit profile',
    friends: 'Friends',
    inviteFriends: 'Invite friends',
    copyInviteLink: 'Copy invite link',
    shareProfile: 'Share profile',
    yourActiveMoves: 'Your active Moves',
    notHostingAnyMoves: "You're not hosting any Moves right now.",
    signOut: 'Sign out',
    language: 'Language',
  },
} as const;

export default en;

// es.ts / zh-Hant.ts are annotated with this (not `typeof en`) so their
// string values stay ordinary `string`, not the literal-typed union `typeof
// en` would force them into - a missing or extra key is still a compile
// error either way.
export type TranslationDictionary = {
  [K in keyof typeof en]: { [K2 in keyof (typeof en)[K]]: string };
};
