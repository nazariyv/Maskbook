import type { SocialNetworkUIInjections } from '../../../social-network/ui'
import { injectKnownIdentityAtTwitter } from './injectKnownIdentity'
import { injectPostDialogAtTwitter } from './injectPostDialog'
import { injectPostDialogHintAtTwitter } from './injectPostDialogHint'
import { injectPostInspectorAtTwitter } from './injectPostInspector'
import { injectPostDialogIconAtTwitter } from './injectPostDialogIcon'
import { injectOptionsPageLinkAtTwitter } from './injectOptionsPageLink'

const injectPostBox = () => {
    injectPostDialogAtTwitter()
    injectPostDialogHintAtTwitter()
    injectPostDialogIconAtTwitter()
}

export const twitterUIInjections: SocialNetworkUIInjections = {
    injectPostBox,
    injectPostInspector: injectPostInspectorAtTwitter,
    injectKnownIdentity: injectKnownIdentityAtTwitter,
    injectOptionsPageLink: injectOptionsPageLinkAtTwitter,
}
