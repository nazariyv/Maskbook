import React from 'react'
import { LiveSelector, MutationObserverWatcher } from '@holoflows/kit'
import { renderInShadowRoot } from '../../../utils/jss/renderInShadowRoot'
import { makeStyles } from '@material-ui/core'
import Services from '../../../extension/service'
import { MaskbookIcon } from '../../../resources/Maskbook-Circle-WhiteGraph-BlueBackground'

const settings = new LiveSelector().querySelector('nav a:nth-child(4)').enableSingleMode()
export function injectOptionsPageLinkAtTwitter() {
    if (location.hostname !== 'mobile.twitter.com') return
    const watcher = new MutationObserverWatcher(settings)
        .setDOMProxyOption({ afterShadowRootInit: { mode: 'closed' } })
        .startWatch({ subtree: true, childList: true })
    renderInShadowRoot(<Link></Link>, {
        shadow: () => withStyle(watcher.firstDOMProxy.afterShadow),
        normal: () => withStyle(watcher.firstDOMProxy.after),
    })
}

const useStyle = makeStyles({
    icon: { width: 28, height: 28, transform: 'translate(6px, 8px)' },
})
function Link() {
    const style = useStyle()
    return (
        <a onClick={() => Services.Welcome.openOptionsPage('/')}>
            <MaskbookIcon className={style.icon}></MaskbookIcon>
        </a>
    )
}
function withStyle<T extends HTMLElement | ShadowRoot>(x: T | null): T {
    if (!x) return x!
    if ('style' in x) (x as HTMLElement).style.flex = '1'
    else
        setTimeout(() => {
            withStyle(x.parentElement)
        }, 200)
    return x
}
