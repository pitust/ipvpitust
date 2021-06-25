export function info(arg: string) {
    console.log(`\x1b[32;1m[*]\x1b[0m \x1b[1;37m%s\x1b[0m`, arg)
}
export function debug(arg: string) {
    console.log(`\x1b[30;1m[*]\x1b[0m \x1b[1;30m%s\x1b[0m`, arg)
}
export function error(arg: string) {
    console.log(`\x1b[31;1m[-]\x1b[0m \x1b[1;37m%s\x1b[0m`, arg)
}
