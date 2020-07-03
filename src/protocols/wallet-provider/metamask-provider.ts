import createMetaMaskProvider from 'metamask-extension-provider'
import w3 from 'web3'
import { AsyncCall, MessageChannel } from 'async-call-rpc/full'
import { EventEmitter } from 'events'
import type { AbstractProvider } from 'web3-core'

const web3 = new w3()
export const metamaskProvider = createMetaMaskProvider()
class Web3JSONRpcChannel extends EventEmitter implements MessageChannel {
    constructor(public currentProvider: AbstractProvider) {
        super()
    }
    on(event: string, eventListener: (data: unknown) => void) {
        super.on('message', eventListener)
        return this
    }
    emit(event: string, data: any) {
        this.currentProvider.sendAsync(data, (error: any, result: unknown) => {
            console.log(result)
            super.emit('message', result)
        })
        console.log('emitting data', data)
        return true
    }
}
export const metamask = AsyncCall<Web3API>(
    {},
    { messageChannel: new Web3JSONRpcChannel(metamaskProvider), strict: false },
)
web3.setProvider(metamaskProvider)

interface Web3API {
    eth_requestAccounts(): string[]
    eth_getBalance(account: string, type: 'latest' | 'earliest' | 'pending'): string
}
