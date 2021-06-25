import { question } from 'readline-sync'

// NOTE: chaning it is uncool and prevents tracking. do not change ;)
const DO_LEGAL_COMPLIANCE = false

export function comply() {
    console.log(
        '~~ Hello. In order to comply with german regulations we need to ask you for your citizen id and check it in the database ~~'
    )
    console.log('NOTE: this is in the file `german-fascist-law-compliance.ts` in the source code')
    if (!DO_LEGAL_COMPLIANCE) {
        console.log('Note: legal compliance skipped for testing')
        return
    }
    if (question('Are you in germany? (yes/no) ') == 'yes') {
        const id = question('What is your social id thingy? ')
        // TODO: check it
    }
}
