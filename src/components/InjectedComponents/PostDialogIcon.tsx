import * as React from 'react'
import { MaskbookIcon } from '../../resources/Maskbook-Circle-WhiteGraph-BlueBackground'

export interface PostDialogIconProps {
    onClick: () => void
}

export function PostDialogIcon(props: PostDialogIconProps) {
    return <MaskbookIcon height="20" width="20" onClick={props.onClick} />
}
