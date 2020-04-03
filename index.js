#!/usr/bin/env node

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

  await bootstrapMainFolder(configuration.bundles.filter(({ targets }) => targets.includes('main')), node.path.join(cwd, 'main'))
  await bootstrapMainFolder(configuration.bundles.filter(({ targets }) => targets.includes('mainta')), node.path.join(cwd, 'mainta'))
  await bootstrapMainFolder(configuration.bundles.filter(({ targets }) => targets.includes('maintt')), node.path.join(cwd, 'maintt'))

  console.log('Operazione completata')

  return 0

}

async function bootstrapMainFolder(bundles, main) {

  console.log(`Configurazione cartella ${main}`)

  const a4t1Folder = node.path.join(main, '../', '.a4t1/')

  const pacoteOptions = {
    registry: 'https://npm.pkg.github.com',
    token: '7409f1ecf4df395b63b97d6c62f0f1f6b01f238f',
    cache: node.path.join(a4t1Folder, 'cache'),
    preferOffline: true,
  }

  if (!node.fs.existsSync(a4t1Folder)) {
    node.fs.mkdirSync(a4t1Folder)
  }

  for (const { name: bundleName, pak3ts } of bundles) {

    for (const { name, hash } of pak3ts) {

      const pak3tPath = node.path.join(main, name)

      if (node.fs.existsSync(pak3tPath)) {
        const localHash = await hasha.fromFile(pak3tPath, { algorithm: 'md5' })
        console.log(`Confronto hash ${name}:`)
        console.log(hash)
        console.log(localHash)
        if (hash == localHash) {
          console.log(`Pak3t ${name} aggiornato`)
          continue
        }
        else {
          console.log(`Necessario aggiornamento pak3t ${name}`)          
        }
      }
      else {
        console.log(`Pak3t ${name} non trovato`)
      }

      const url = await pacote.resolve(`@a4t1/${bundleName}@latest`, pacoteOptions)

      console.log(`Download ${bundleName} da ${url}...`)

      const downloadFolder = node.path.join(a4t1Folder, bundleName)
      await pacote.extract(url, downloadFolder, pacoteOptions)

      const downloadedPak3t = node.path.join(downloadFolder, 'dist', name)

      if (node.fs.existsSync(downloadedPak3t)) {
        node.fs.copyFileSync(downloadedPak3t, node.path.join(main, name))
      }

    }

  }

  return 0

}