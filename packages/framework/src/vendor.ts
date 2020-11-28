import * as R from './rules'
import * as V from 'validator-ts'
import { abi } from 'thor-devkit'

export function newVendor(driver: Connex.Driver): Connex.Vendor {
    return {
        sign: <T extends 'tx' | 'cert'>(kind: T, msg: T extends 'tx' ? Connex.Vendor.TxMessage : Connex.Vendor.CertMessage): any => {
            if (kind === 'tx') {
                R.test(msg as Connex.Vendor.TxMessage, [clauseScheme], 'arg1')
                return newTxSigningService(Promise.resolve(driver), msg as Connex.Vendor.TxMessage)
            } else if (kind === 'cert') {
                R.test(msg as Connex.Vendor.CertMessage, {
                    purpose: v => (v === 'agreement' || v === 'identification') ?
                        '' : `expected 'agreement' or 'identification'`,
                    payload: {
                        type: v => v === 'text' ? '' : `expected 'text'`,
                        content: R.string
                    }
                }, 'arg1')
                return newCertSigningService(Promise.resolve(driver), msg as Connex.Vendor.CertMessage)
            } else {
                throw new R.BadParameter(`arg0: expected 'tx' or 'cert'`)
            }
        }
    }
}

export function newTxSigningService(readyDriver: Promise<Connex.Driver>, msg: Connex.Vendor.TxMessage): Connex.Vendor.TxSigningService {
    const opts: Connex.Driver.TxOptions = {}

    return {
        signer(addr) {
            opts.signer = R.test(addr, R.address, 'arg0').toLowerCase()
            return this
        },
        gas(gas) {
            opts.gas = R.test(gas, R.uint64, 'arg0')
            return this
        },
        dependsOn(txid) {
            opts.dependsOn = R.test(txid, R.bytes32, 'arg0').toLowerCase()
            return this
        },
        link(url) {
            opts.link = R.test(url, R.string, 'arg0')
            return this
        },
        comment(text) {
            opts.comment = R.test(text, R.string, 'arg0')
            return this
        },
        delegate(delegator) {
            R.ensure(typeof delegator === 'string', `arg0: expected url string`)
            opts.delegator = delegator
            return this
        },
        accepted(cb) {
            R.ensure(typeof cb === 'function', 'arg0: expected function')
            opts.onAccepted = cb
            return this
        },
        request() {
            return (async () => {
                try {
                    const driver = await readyDriver
                    return await driver.signTx(msg, opts)
                } catch (err) {
                    throw new Rejected(err.message)
                }
            })()
        }
    }
}

function newCertSigningService(readyDriver: Promise<Connex.Driver>, msg: Connex.Vendor.CertMessage): Connex.Vendor.CertSigningService {
    const opts: Connex.Driver.CertOptions = {}

    return {
        signer(addr) {
            opts.signer = R.test(addr, R.address, 'arg0').toLowerCase()
            return this
        },
        link(url) {
            opts.link = R.test(url, R.string, 'arg0')
            return this
        },
        accepted(cb) {
            R.ensure(typeof cb === 'function', 'arg0: expected function')
            opts.onAccepted = cb
            return this
        },
        request() {
            return (async () => {
                try {
                    const driver = await readyDriver
                    return await driver.signCert(msg, opts)
                } catch (err) {
                    throw new Rejected(err.message)
                }
            })()
        }
    }
}

class Rejected extends Error {
    constructor(msg: string) {
        super(msg)
    }
}

Rejected.prototype.name = 'Rejected'

const clauseScheme: V.Scheme<Connex.Vendor.TxMessage[number]> = {
    to: V.nullable(R.address),
    value: R.bigInt,
    data: V.optional(R.bytes),
    comment: V.optional(R.string),
    abi: V.optional(v => {
        if (!(v instanceof Object)) {
            return 'expected object'
        }
        try {
            new abi.Function(v as any).signature
            return ''
        } catch (err) {
            return `expected valid ABI (${err.message})`
        }
    })
}
