import React, { useEffect } from 'react'
import { Popper, Paper, Grow, MenuList, PopperProps, makeStyles } from '@material-ui/core'
import { noop } from 'lodash-es'
import { useStylesExtends } from '../custom-ui-helper'

const useStyles = makeStyles({})

export interface PostDialogDropdownProps extends withClasses<KeysInferFromUseStyles<typeof useStyles>> {
    open: boolean
    anchorRef: React.RefObject<HTMLElement | null>
    items?: JSX.Element[]
    onClose?: () => void
    PopperProps?: Partial<PopperProps>
}

export function PostDialogDropdown(props: PostDialogDropdownProps) {
    const classes = useStylesExtends(useStyles(), props)
    const { items = [], anchorRef, open, onClose = noop, PopperProps } = props

    const prevOpen = React.useRef(open)
    useEffect(() => {
        if (prevOpen.current && !open) anchorRef.current!.focus()
        prevOpen.current = open
    }, [open])

    return (
        <Popper open={open} anchorEl={anchorRef.current} transition disablePortal {...PopperProps}>
            {({ TransitionProps, placement }) => (
                <Grow
                    {...TransitionProps}
                    style={{ transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom' }}>
                    <Paper>
                        <MenuList autoFocusItem={open} onClick={onClose}>
                            {items.map((item, index) =>
                                React.cloneElement(item, {
                                    key: index,
                                }),
                            )}
                        </MenuList>
                    </Paper>
                </Grow>
            )}
        </Popper>
    )
}
