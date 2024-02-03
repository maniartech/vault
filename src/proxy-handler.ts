
const proxyHandler = {
  get(target: any, key: string)             { return (typeof target[key] === 'function') ? target[key].bind(target) : key in target ? target[key] : target.getItem(key) },
  set(target: any, key: string, value: any) { return target.setItem(key, value) },
  deleteProperty(target: any, key: string)  { return target.removeItem(key) }
}

export default proxyHandler
