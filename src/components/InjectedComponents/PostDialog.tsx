import React from 'react'
import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import {
    makeStyles,
    InputBase,
    Button,
    Typography,
    IconButton,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Chip,
    ThemeProvider,
    Theme,
    DialogProps,
    Tooltip,
    Link,
    MenuItem,
    Divider,
} from '@material-ui/core'
import AddIcon from '@material-ui/icons/Add'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import { MessageCenter, CompositionEvent } from '../../utils/messages'
import { useCapturedInput } from '../../utils/hooks/useCapturedEvents'
import { useStylesExtends, or } from '../custom-ui-helper'
import type { Profile, Group } from '../../database'
import { useFriendsList, useGroupsList, useCurrentIdentity, useMyIdentities } from '../DataSource/useActivatedUI'
import { currentPayloadType } from '../shared-settings/settings'
import { useValueRef } from '../../utils/hooks/useValueRef'
import { getActivatedUI } from '../../social-network/ui'
import Services from '../../extension/service'
import { SelectRecipientsUIProps, isProfile } from '../shared/SelectRecipients/SelectRecipients'
import { DialogDismissIconUI } from './DialogDismissIcon'
import { ClickableChip } from '../shared/SelectRecipients/ClickableChip'
import RedPacketDialog from '../../plugins/Wallet/UI/RedPacket/RedPacketDialog'
import {
    makeTypedMessage,
    TypedMessage,
    withMetadata,
    readTypedMessageMetadata,
    extractTextFromTypedMessage,
    withMetadataUntyped,
} from '../../extension/background-script/CryptoServices/utils'
import { EthereumTokenType } from '../../plugins/Wallet/database/types'
import { isDAI, isOKB } from '../../plugins/Wallet/token'
import { PluginRedPacketTheme } from '../../plugins/Wallet/theme'
import { useI18N } from '../../utils/i18n-next-ui'
import ShadowRootDialog from '../../utils/jss/ShadowRootDialog'
import { twitterUrl } from '../../social-network-provider/twitter.com/utils/url'
import { RedPacketMetaKey } from '../../plugins/Wallet/RedPacketMetaKey'
import { PluginUI } from '../../plugins/plugin'
import { PostDialogDropdown } from './PostDialogDropdown'

import { resolveSpecialGroupName } from '../shared/SelectPeopleAndGroups/resolveSpecialGroupName'

const defaultTheme = {}

const useStyles = makeStyles({
    MUIInputRoot: {
        minHeight: 108,
        flexDirection: 'column',
        padding: 10,
        boxSizing: 'border-box',
    },
    MUIInputInput: {
        fontSize: 18,
        minHeight: '8em',
    },
    header: {
        display: 'flex',
    },
    title: {
        '& > h2': {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
        },
    },
    text: {
        marginLeft: 6,
        flex: 1,
    },
    actions: {
        paddingLeft: 26,
    },
})

type PayloadType = 'image' | 'text'
type RecipientType = 'unset' | 'anyone' | 'myself' | 'group_friends' | 'specific_friends'

export interface PostDialogUIProps
    extends withClasses<
        | KeysInferFromUseStyles<typeof useStyles>
        | 'root'
        | 'dialog'
        | 'backdrop'
        | 'container'
        | 'paper'
        | 'input'
        | 'header'
        | 'content'
        | 'actions'
        | 'close'
        | 'button'
        | 'label'
        | 'switch'
    > {
    theme?: Theme
    open: boolean
    groups: Array<Group>
    profiles: Array<Profile>
    currentShareTarget: Array<Profile | Group>
    currentIdentity: Profile | null
    postContent: TypedMessage
    postBoxButtonDisabled: boolean
    payloadType: PayloadType
    recipientType: RecipientType
    onPostContentChanged: (nextMessage: TypedMessage) => void
    onPayloadTypeChanged: (type: PayloadType) => void
    onRecipientTypeChanged: (type: RecipientType) => void
    onFinishButtonClicked: () => void
    onCloseButtonClicked: () => void
    onSetSelected: SelectRecipientsUIProps['onSetSelected']
    DialogProps?: Partial<DialogProps>
    SelectRecipientsUIProps?: Partial<SelectRecipientsUIProps>
}
export function PostDialogUI(props: PostDialogUIProps) {
    const classes = useStylesExtends(useStyles(), props)
    const { t } = useI18N()
    const [, inputRef] = useCapturedInput(
        (newText) => {
            const msg = props.postContent
            if (msg.type === 'text') props.onPostContentChanged(makeTypedMessage(newText, msg.meta))
            else throw new Error('Not impled yet')
        },
        [props.open, props.postContent],
    )
    const [redPacketDialogOpen, setRedPacketDialogOpen] = useState(false)

    //#region payload type
    const payloadSwitchRef = useRef<HTMLButtonElement | null>(null)
    const [payloadDropmenuOpen, setPayloadDropmenuOpen] = useState(false)
    const payloadDropmenuItems = [
        <MenuItem onClick={() => props.onPayloadTypeChanged('image')}>🖼️ Image Payload</MenuItem>,
        <MenuItem onClick={() => props.onPayloadTypeChanged('text')}>📒 Text Payload</MenuItem>,
    ]
    //#endregion

    //#region recipient type
    const recipientSwitchRef = useRef<HTMLButtonElement | null>(null)
    const [recipientDropmenuOpen, setRecipientDropmenuOpen] = useState(false)
    const recipientDropmenuItems = [
        <MenuItem onClick={() => props.onRecipientTypeChanged('anyone')}>Anyone on Maskbook</MenuItem>,
        <MenuItem onClick={() => props.onRecipientTypeChanged('myself')}>Only myself</MenuItem>,
        ...props.groups.map((group) => (
            <MenuItem
                onClick={() => {
                    props.onRecipientTypeChanged('group_friends')
                    props.onSetSelected([group])
                }}>
                {resolveSpecialGroupName(t, (group as any) as Group, props.profiles)}
            </MenuItem>
        )),
        <MenuItem>
            Specific Friends (0 selected) <AddIcon />
        </MenuItem>,
    ]
    //#endregion

    const onDropmenuRootClick = (ev: React.MouseEvent<HTMLElement>) => {
        const target = ev.target as HTMLElement
        if (payloadDropmenuOpen && !payloadSwitchRef.current?.contains(target)) setPayloadDropmenuOpen(false)
        if (recipientDropmenuOpen && !recipientSwitchRef.current?.contains(target)) setRecipientDropmenuOpen(false)
    }

    if (props.postContent.type !== 'text') return <>Unsupported type to edit</>
    const metadataBadge = [...PluginUI].flatMap((plugin) => {
        const knownMeta = plugin.postDialogMetadataBadge
        if (!knownMeta) return undefined
        return [...knownMeta.entries()].map(([metadataKey, tag]) => {
            return withMetadataUntyped(props.postContent.meta, metadataKey, (r) => (
                <Box key={metadataKey} marginRight={1} marginTop={1} display="inline-block">
                    <Tooltip title={`Provided by plugin "${plugin.pluginName}"`}>
                        <Chip
                            onDelete={() => {
                                const ref = getActivatedUI().typedMessageMetadata
                                const next = new Map(ref.value.entries())
                                next.delete(metadataKey)
                                ref.value = next
                            }}
                            label={tag(r)}
                        />
                    </Tooltip>
                </Box>
            ))
        })
    })

    return (
        <div className={classes.root} onClick={onDropmenuRootClick}>
            <ThemeProvider theme={props.theme ?? defaultTheme}>
                <ShadowRootDialog
                    className={classes.dialog}
                    classes={{
                        container: classes.container,
                        paper: classes.paper,
                    }}
                    open={props.open}
                    scroll="paper"
                    fullWidth
                    maxWidth="sm"
                    disableAutoFocus
                    disableEnforceFocus
                    onEscapeKeyDown={props.onCloseButtonClicked}
                    BackdropProps={{
                        className: classes.backdrop,
                    }}
                    {...props.DialogProps}>
                    <DialogTitle className={classes.header} classes={{ root: classes.title }}>
                        <IconButton
                            classes={{ root: classes.close }}
                            aria-label={t('post_dialog__dismiss_aria')}
                            onClick={props.onCloseButtonClicked}>
                            <DialogDismissIconUI />
                        </IconButton>
                        <Typography className={classes.text} variant="inherit" component="div">
                            {t('post_dialog__title')}
                        </Typography>
                        <Button ref={payloadSwitchRef} variant="text" onClick={() => setPayloadDropmenuOpen((p) => !p)}>
                            {props.payloadType === 'image' ? '🖼️  Image Payload' : '📒  Text Payload'}{' '}
                            <ArrowDropDownIcon />
                        </Button>
                    </DialogTitle>
                    <DialogContent className={classes.content}>
                        {metadataBadge}
                        <InputBase
                            classes={{
                                root: classes.MUIInputRoot,
                                input: classes.MUIInputInput,
                            }}
                            inputProps={{ className: classes.input }}
                            autoFocus
                            value={props.postContent.content}
                            inputRef={inputRef}
                            fullWidth
                            multiline
                            placeholder={t('post_dialog__placeholder')}
                        />

                        <Typography style={{ marginBottom: 10 }}>Plugins (Experimental)</Typography>
                        <Box style={{ marginBottom: 10 }} display="flex" flexWrap="wrap">
                            {/* without redpacket */}
                            {webpackEnv.target !== 'WKWebview' && (
                                <ClickableChip
                                    ChipProps={{
                                        label: '💰 Red Packet',
                                        onClick: async () => {
                                            const { wallets } = await Services.Plugin.getWallets()
                                            if (wallets.length) {
                                                setRedPacketDialogOpen(true)
                                            } else {
                                                Services.Welcome.openOptionsPage('/wallets?error=nowallet')
                                            }
                                        },
                                    }}
                                />
                            )}
                        </Box>

                        <Divider />

                        {/* <Typography style={{ marginBottom: 10 }}>
                            {t('post_dialog__select_recipients_title')}
                        </Typography>
                        <Box style={{ marginBottom: 10 }} display="flex" flexWrap="wrap">
                            <SelectRecipientsUI
                                disabled={props.onlyMyself || props.shareToEveryone}
                                items={props.availableShareTarget}
                                selected={props.currentShareTarget}
                                onSetSelected={props.onSetSelected}
                                {...props.SelectRecipientsUIProps}>
                                <ClickableChip
                                    checked={props.shareToEveryone}
                                    ChipProps={{
                                        disabled: props.onlyMyself,
                                        label: t('post_dialog__select_recipients_share_to_everyone'),
                                        onClick: () => props.onShareToEveryoneChanged(!props.shareToEveryone),
                                    }}
                                />
                                <ClickableChip
                                    checked={props.onlyMyself}
                                    ChipProps={{
                                        disabled: props.shareToEveryone,
                                        label: t('post_dialog__select_recipients_only_myself'),
                                        onClick: () => props.onOnlyMyselfChanged(!props.onlyMyself),
                                    }}
                                />
                            </SelectRecipientsUI>
                        </Box> */}

                        {/* This feature is not ready for mobile version */}
                        {/* {webpackEnv.target !== 'WKWebview' && webpackEnv.firefoxVariant !== 'android' ? (
                            <>
                                <Typography style={{ marginBottom: 10 }}>
                                    {t('post_dialog__more_options_title')}
                                </Typography>
                                <Box style={{ marginBottom: 10 }} display="flex" flexWrap="wrap">
                                    <ClickableChip
                                        checked={props.imagePayload}
                                        ChipProps={{
                                            label: t('post_dialog__image_payload'),
                                            onClick: () => props.onImagePayloadSwitchChanged(!props.imagePayload),
                                        }}
                                    />
                                </Box>
                            </>
                        ) : null} */}
                    </DialogContent>
                    <DialogActions className={classes.actions}>
                        <Box display="flex" flexDirection="column" alignItems="flex-start">
                            <Button
                                ref={recipientSwitchRef}
                                variant="text"
                                onClick={() => setRecipientDropmenuOpen((p) => !p)}>
                                Anyone on Maskbook can decrypt
                                <ArrowDropDownIcon />
                            </Button>
                            {/* <Typography>
                                Not posting as
                                <Button size="small">xxx</Button>?
                            </Typography> */}
                        </Box>
                        <Button
                            className={classes.button}
                            style={{ marginLeft: 'auto' }}
                            color="primary"
                            variant="contained"
                            disabled={props.postBoxButtonDisabled}
                            onClick={props.onFinishButtonClicked}>
                            {t('post_dialog__button')}
                        </Button>
                    </DialogActions>
                    <PostDialogDropdown
                        open={payloadDropmenuOpen}
                        anchorRef={payloadSwitchRef}
                        items={payloadDropmenuItems}
                        onClose={() => setPayloadDropmenuOpen(false)}
                    />
                    <PostDialogDropdown
                        open={recipientDropmenuOpen}
                        anchorRef={recipientSwitchRef}
                        items={recipientDropmenuItems}
                        onClose={() => setRecipientDropmenuOpen(false)}
                    />
                </ShadowRootDialog>
            </ThemeProvider>
            {!process.env.STORYBOOK && (
                <RedPacketDialog
                    classes={classes}
                    open={props.open && redPacketDialogOpen}
                    onConfirm={() => setRedPacketDialogOpen(false)}
                    onDecline={() => setRedPacketDialogOpen(false)}
                    DialogProps={props.DialogProps}
                />
            )}
        </div>
    )
}

export interface PostDialogProps extends Omit<Partial<PostDialogUIProps>, 'open'> {
    open?: [boolean, (next: boolean) => void]
    reason?: 'timeline' | 'popup'
    identities?: Profile[]
    onRequestPost?: (target: (Profile | Group)[], content: TypedMessage) => void
    onRequestReset?: () => void
    typedMessageMetadata?: ReadonlyMap<string, any>
}
export function PostDialog(props: PostDialogProps) {
    const { t, i18n } = useI18N()
    const typedMessageMetadata = or(props.typedMessageMetadata, useValueRef(getActivatedUI().typedMessageMetadata))
    const [open, setOpen] = or(props.open, useState<boolean>(false)) as NonNullable<PostDialogProps['open']>

    //#region TypedMessage
    const [postBoxContent, setPostBoxContent] = useState<TypedMessage>(makeTypedMessage('', typedMessageMetadata))
    useEffect(() => {
        if (typedMessageMetadata !== postBoxContent.meta)
            setPostBoxContent({ ...postBoxContent, meta: typedMessageMetadata })
    }, [typedMessageMetadata, postBoxContent])
    //#endregion

    //#region share target
    const currentIdentity = or(props.currentIdentity, useCurrentIdentity())
    const [currentShareTarget, setCurrentShareTarget] = useState<(Profile | Group)[]>(() => [])
    const profiles = useFriendsList().filter(
        (x) => isProfile(x) && !x.identifier.equals(currentIdentity?.identifier) && x.linkedPersona?.fingerprint,
    )
    const groups = useGroupsList()
    //#endregion

    //#region recipient type
    const [recipientType, setRecipientType] = useState<RecipientType>('unset')
    const onlyMyself = recipientType === 'myself'
    const shareToEveryone = recipientType === 'anyone'
    //#endregion

    //#region payload type
    const payloadType = useValueRef(currentPayloadType[getActivatedUI().networkIdentifier])
    const imagePayloadEnabled = payloadType === 'image'
    const onPayloadTypeChanged = or(
        props.onPayloadTypeChanged,
        useCallback((type) => {
            currentPayloadType[getActivatedUI().networkIdentifier].value = type
        }, []),
    )
    //#endregion

    const onRequestPost = or(
        props.onRequestPost,
        useCallback(
            async (target: (Profile | Group)[], content: TypedMessage) => {
                const [encrypted, token] = await Services.Crypto.encryptTo(
                    content,
                    target.map((x) => x.identifier),
                    currentIdentity!.identifier,
                    !!shareToEveryone,
                )
                const activeUI = getActivatedUI()
                // TODO: move into the plugin system
                const metadata = readTypedMessageMetadata(typedMessageMetadata, RedPacketMetaKey)
                if (imagePayloadEnabled) {
                    const isRedPacket = metadata.ok && metadata.val.rpid
                    const isErc20 =
                        metadata.ok &&
                        metadata.val &&
                        metadata.val.token &&
                        metadata.val.token_type === EthereumTokenType.ERC20
                    const isDai = isErc20 && metadata.ok && isDAI(metadata.val.token?.address ?? '')
                    const isOkb = isErc20 && metadata.ok && isOKB(metadata.val.token?.address ?? '')

                    activeUI.taskPasteIntoPostBox(
                        t('additional_post_box__steganography_post_pre', { random: String(Date.now()) }),
                        { shouldOpenPostDialog: false },
                    )
                    activeUI.taskUploadToPostBox(encrypted, {
                        template: isRedPacket ? (isDai ? 'dai' : isOkb ? 'okb' : 'eth') : 'v2',
                        warningText: t('additional_post_box__steganography_post_failed'),
                    })
                } else {
                    let text = t('additional_post_box__encrypted_post_pre', { encrypted })
                    if (metadata.ok) {
                        if (i18n.language.includes('zh')) {
                            text =
                                activeUI.networkIdentifier === twitterUrl.hostIdentifier
                                    ? `用 #Maskbook @realMaskbook 開啟紅包 ${encrypted}`
                                    : `用 #Maskbook 開啟紅包 ${encrypted}`
                        } else {
                            text =
                                activeUI.networkIdentifier === twitterUrl.hostIdentifier
                                    ? `Claim this Red Packet with #Maskbook @realMaskbook ${encrypted}`
                                    : `Claim this Red Packet with #Maskbook ${encrypted}`
                        }
                    }
                    activeUI.taskPasteIntoPostBox(text, {
                        warningText: t('additional_post_box__encrypted_failed'),
                        shouldOpenPostDialog: false,
                    })
                }
                // This step write data on gun.
                // there is nothing to write if it shared with public
                if (!shareToEveryone) Services.Crypto.publishPostAESKey(token)
            },
            [currentIdentity, shareToEveryone, typedMessageMetadata, imagePayloadEnabled, t, i18n.language],
        ),
    )
    const onRequestReset = or(
        props.onRequestReset,
        useCallback(() => {
            setOpen(false)
            setRecipientType('unset')
            setPostBoxContent(makeTypedMessage(''))
            setCurrentShareTarget([])
            getActivatedUI().typedMessageMetadata.value = new Map()
        }, [setOpen]),
    )
    const onFinishButtonClicked = useCallback(() => {
        onRequestPost(onlyMyself ? [currentIdentity!] : currentShareTarget, postBoxContent)
        onRequestReset()
    }, [currentIdentity, currentShareTarget, onRequestPost, onRequestReset, onlyMyself, postBoxContent])
    const onCloseButtonClicked = useCallback(() => {
        setOpen(false)
    }, [setOpen])
    //#endregion
    //#region My Identity
    const identities = useMyIdentities()
    useEffect(() => {
        return MessageCenter.on('compositionUpdated', ({ reason, open }: CompositionEvent) => {
            if (reason === props.reason && identities.length > 0) {
                setOpen(open)
            }
        })
    }, [identities.length, props.reason, setOpen])
    //#endregion
    //#region Red Packet
    // TODO: move into the plugin system
    const hasRedPacket = readTypedMessageMetadata(postBoxContent.meta, RedPacketMetaKey).ok
    const theme = hasRedPacket ? PluginRedPacketTheme : undefined
    const mustSelectShareToEveryone = hasRedPacket && !shareToEveryone

    useEffect(() => {
        if (mustSelectShareToEveryone) setRecipientType('anyone')
    }, [mustSelectShareToEveryone, setRecipientType])
    //#endregion

    return (
        <PostDialogUI
            theme={theme}
            groups={groups}
            profiles={profiles}
            currentIdentity={currentIdentity}
            currentShareTarget={currentShareTarget}
            postContent={postBoxContent}
            postBoxButtonDisabled={
                !(onlyMyself || shareToEveryone
                    ? extractTextFromTypedMessage(postBoxContent).val
                    : currentShareTarget.length && extractTextFromTypedMessage(postBoxContent).val)
            }
            payloadType={payloadType}
            recipientType={recipientType}
            onSetSelected={setCurrentShareTarget}
            onPostContentChanged={setPostBoxContent}
            onPayloadTypeChanged={onPayloadTypeChanged}
            onRecipientTypeChanged={setRecipientType}
            onFinishButtonClicked={onFinishButtonClicked}
            onCloseButtonClicked={onCloseButtonClicked}
            {...props}
            open={open}
            classes={{ ...props.classes }}
        />
    )
}

PostDialog.defaultProps = {
    reason: 'timeline',
}
