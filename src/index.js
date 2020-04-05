#!/usr/bin/env node

// require modules
const node = {
  fs: require('fs'),
  path: require('path'),
  process: require('process'),
}
const hasha = require('hasha')
const pacote = require('pacote')
const prompts = require('prompts')
const ora = require('ora')
const semver = require('semver')

require('yargs')
  .scriptName('luk3')
  .usage('$0 <cmd> [args]')
  .command(['$0', 'bootstrap'], 'Aggiorna e ripristina i pacchetti A4T1', (yargs) => {
    yargs
      .option('token', {
        alias: 't',
        demandOption: false,
        default: undefined,
        describe: `Token di autenticazione`,
        type: 'string'
      })
      .option('path', {
        alias: 'p',
        demandOption: false,
        default: node.process.cwd(),
        describe: `Percorso della cartella principale di MOHAA
(e.g. --path C:\\Games\\MOHAA)`,
        type: 'string'
      })
      .option('force', {
        alias: 'f',
        demandOption: false,
        default: false,
        describe: 'Forza l\'esecuzione',
        type: 'boolean'
      })
  }, bootstrap)
  .help()
  .argv

async function bootstrap({ token, path, force }) {

  try {

    console.log()

    const cwd = path && node.path.isAbsolute(path)
      ? path
      : node.path.join(node.process.cwd(), path)

    const a4t1Folder = node.path.join(cwd, '.a4t1/')

    let authToken = undefined
    try {
      authToken = token || node.fs.readFileSync(node.path.join(cwd, 'LUK3_TOK3N'), { encoding: 'utf8' })
    }
    catch (err) {
      throw new Error(`Token di autenticazione non disponibile!
  Assicurarsi di avere copiato il file LUK3_TOK3N nella cartella principale di
  MOHAA, oppure utilizzare l'opzione --token`)
    }

    const pacoteOptions = {
      registry: 'https://npm.pkg.github.com/',
      token: authToken,
      cache: node.path.join(a4t1Folder, 'cache'),
      preferOffline: true,
    }

    if (!node.fs.existsSync(node.path.join(cwd, 'MOHAA.exe'))) {
      if (!force) {
        throw new Error(`MOHAA.exe non trovato!
  Esegui il comando nella cartella principale di MOHAA o usa l'opzione --path`)
      }
    }

    const configFolder = node.path.join(a4t1Folder, 'luk3-config')

    const checkUpdates = ora(`Verifica disponibilità aggiornamenti`).start()
    try {
      const currentVersion = JSON.parse(node.fs.readFileSync(node.path.join(__dirname, '..', 'package.json'))).version
      const { version: availableVersion } = await pacote.manifest(`@a4t1/luk3@latest`, pacoteOptions)
      checkUpdates.succeed()

      if (true || semver.lt(currentVersion, availableVersion)) {        
        console.log(`
È disponibile la nuova versione ${availableVersion}.
Puoi scaricarla da https://github.com/a4t1/luk3/releases`)
      }
    }
    catch (err) {
      checkUpdates.fail()
      console.error(err)
    }

    console.log()

    const downloadConfig = ora(`Download configurazione da ${pacoteOptions.registry}`).start()
    try {
      const url = await pacote.resolve(`@a4t1/luk3-config@latest`, pacoteOptions)
      await pacote.extract(url, configFolder, pacoteOptions)
      downloadConfig.succeed()
    }
    catch (err) {
      downloadConfig.fail()
      throw err
    }

    const configuration = require(node.path.join(configFolder, 'config.js'))

    for (const bundle of configuration.bundles) {
      await bootstrapBundle(bundle, cwd, pacoteOptions)
    }

    console.log()
    console.log(`Operazione completata`)
    console.log()

    await confirmExit()

    node.process.exit(0)

    return 0
  }
  catch (err) {

    console.error(`Si è verificato un errore`)
    console.error(err)
    console.log()

    await confirmExit()

    node.process.exit(-1)
  }
}

async function confirmExit() {
  const response = await prompts({
    type: 'invisible',
    name: 'value',
    message: 'Premi INVIO per uscire'
  })
  return response
}

async function bootstrapBundle({ name: bundleName, targets, pak3ts }, cwd, pacoteOptions) {

  console.log()
  const verifica = ora(`Verifica bundle ${bundleName}`).start()

  try {

    const a4t1Folder = node.path.join(cwd, '.a4t1/')

    const targetsToUpdate = []

    for (const target of targets) {

      const targetPath = node.path.join(cwd, target)

      for (const { name, hash } of pak3ts) {

        const pak3tPath = node.path.join(targetPath, name)

        if (node.fs.existsSync(pak3tPath)) {
          const localHash = hasha.fromFileSync(pak3tPath, { algorithm: 'md5' })
          if (localHash == hash) continue
        }

        targetsToUpdate.push({
          targetPath,
          pak3t: name
        })

      }

    }

    verifica.succeed()

    if (targetsToUpdate.length > 0) {

      console.warn(`  Necessario l'aggiornamento dei seguenti pacchetti:`)
      for (const tup of targetsToUpdate) {
        console.warn(`  - ${node.path.join(node.path.relative(cwd, tup.targetPath), tup.pak3t)}`)
      }

      const downloadFolder = node.path.join(a4t1Folder, bundleName)

      const download = ora(`Download ${bundleName} da ${pacoteOptions.registry}`).start()
      try {
        const url = await pacote.resolve(`@a4t1/${bundleName}@latest`, pacoteOptions)  
        await pacote.extract(url, downloadFolder, pacoteOptions)  
        download.succeed()
      }
      catch (err) {
        download.fail()
        console.error(err)
      }

      for (const { pak3t, targetPath } of targetsToUpdate) {

        const destinationPath = node.path.join(targetPath, pak3t)

        const update = ora(`Aggiornamento ${node.path.relative(cwd, destinationPath)}`)

        try {
          const downloadedPak3t = node.path.join(downloadFolder, 'dist', pak3t)  
          if (node.fs.existsSync(downloadedPak3t)) {
            node.fs.copyFileSync(downloadedPak3t, destinationPath)
            update.succeed()
          }
          else {
            update.fail(`Pacchetto ${node.path.relative(cwd, destinationPath)} non trovato`)
          }
        }
        catch(err) {
          update.fail(`Aggiornamento ${node.path.relative(cwd, destinationPath)} fallito`)
        }

      }
    }

  }
  catch (err) {
    verifica.fail(`Verifica bundle ${bundleName} fallita`)
    console.error(err)
  }

  return 0

}
