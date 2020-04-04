#!/usr/bin/env node

const TOKEN = '60f3e2f89f17ab7833f5877c4dc05cf1187ccba2'

// require modules
const node = {
  fs: require('fs'),
  path: require('path'),
  process: require('process'),
}
const hasha = require('hasha')
const pacote = require('pacote')

require('yargs')
  .scriptName('luk3')
  .usage('$0 <cmd> [args]')
  .command(['$0', 'bootstrap'], 'Aggiorna e ripristina i pacchetti A4T1', (yargs) => {
    yargs
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

async function bootstrap({ path, force }) {

  const cwd = path && node.path.isAbsolute(path)
    ? path
    : node.path.join(node.process.cwd(), path)

  if (!node.fs.existsSync(node.path.join(cwd, 'MOHAA.exe'))) {
    if (!force) {
      throw new Error(`MOHAA.exe non trovato!
Esegui il comando nella cartella principale di MOHAA o usa l'opzione --path`)
    }
  }

  // TODO: download configuration
  const configuration = {
    version: '1.0.0',
    bundles: [
      {
        name: 'skinpack-01',
        targets: ['main', 'mainta', 'maintt'],
        pak3ts: [
          {
            name: 'A4T1-skinpack-01.pk3',
            hash: '490644880834e8c19dca5605cc4fba28',
          }
        ]
      }
    ]
  }

  for (const bundle of configuration.bundles) {
    await bootstrapBundle(bundle, cwd)
  }

  console.log('Operazione completata')

  node.process.exit(0)

  return 0

}

async function bootstrapBundle({ name: bundleName, targets, pak3ts }, cwd) {

  console.log(`Verifica bundle ${bundleName}`)

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

  if (targetsToUpdate.length > 0) {

    console.log(`Necessario l'aggiornamento dei seguenti pacchetti:`)
    for (const tup of targetsToUpdate) {
      console.log(`- ${node.path.join(node.path.relative(cwd, tup.targetPath), tup.pak3t)}`)
    }

    const a4t1Folder = node.path.join(cwd, '.a4t1/')

    const pacoteOptions = {
      registry: 'https://npm.pkg.github.com/',
      token: TOKEN,
      cache: node.path.join(a4t1Folder, 'cache'),
      preferOffline: true,
    }

    const url = await pacote.resolve(`@a4t1/${bundleName}@latest`, pacoteOptions)

    console.log(`Download ${bundleName} da ${pacoteOptions.registry}...`)

    const downloadFolder = node.path.join(a4t1Folder, bundleName)
    await pacote.extract(url, downloadFolder, pacoteOptions)

    for (const { pak3t, targetPath } of targetsToUpdate) {

      const downloadedPak3t = node.path.join(downloadFolder, 'dist', pak3t)

      if (node.fs.existsSync(downloadedPak3t)) {
        node.fs.copyFileSync(downloadedPak3t, node.path.join(targetPath, pak3t))

        console.log(`Pacchetto ${pak3t} aggiornato`)
      }

    }
  }

  console.log(`Tutti i pacchetti del bundle ${bundleName} sono aggiornati`)
  return 0

}
