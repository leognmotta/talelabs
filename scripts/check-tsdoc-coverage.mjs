import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import ts from 'typescript'

const PACKAGE_ENTRY = /^packages\/[^/]+\/src\/index\.ts$/
const AUTHORED_TYPESCRIPT = /^(?:apps|packages)\/.+\.tsx?$/
const EXCLUDED_PATH = /(?:^|\/)(?:dist|node_modules)(?:\/|$)|\/src\/gen\//

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function changedAuthoredTypeScript(baseRef) {
  const outputs = []
  if (baseRef) {
    const mergeBase = runGit(['merge-base', 'HEAD', baseRef]).trim()
    outputs.push(runGit([
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      `${mergeBase}...HEAD`,
    ]))
  }
  outputs.push(runGit(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']))
  outputs.push(runGit(['ls-files', '--others', '--exclude-standard']))
  return [...new Set(outputs.flatMap(output => output.split('\n')))]
    .filter(file => AUTHORED_TYPESCRIPT.test(file))
    .filter(file => !file.endsWith('.d.ts') && !EXCLUDED_PATH.test(file))
    .toSorted()
}

function main() {
  const args = process.argv.slice(2)
  const baseRef = args[0] === '--base' && args[1] ? args[1] : undefined
  if (args.length > (baseRef ? 2 : 0))
    throw new Error('Usage: node scripts/check-tsdoc-coverage.mjs [--base <git-ref>]')

  const files = changedAuthoredTypeScript(baseRef)
  const errors = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    if (source.includes('@generated'))
      continue
    const overview = source.match(/^\s*(\/\*\*[\s\S]*?\*\/)/)?.[1]
    if (!overview) {
      errors.push(`${file}: missing leading module overview`)
      continue
    }
    const hasPackageDocumentation = source.includes('@packageDocumentation')
    const overviewHasPackageDocumentation = overview.includes('@packageDocumentation')
    const isPackageEntry = PACKAGE_ENTRY.test(file)
    if (hasPackageDocumentation && !isPackageEntry) {
      errors.push(`${file}: @packageDocumentation is reserved for package entry points`)
    }
    if (isPackageEntry && !overviewHasPackageDocumentation) {
      errors.push(`${file}: package entry point must use @packageDocumentation`)
    }

    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    for (const statement of sourceFile.statements) {
      if (
        ts.isExportDeclaration(statement)
        || ts.isExportAssignment(statement)
        || ts.isImportDeclaration(statement)
      ) {
        continue
      }
      const modifiers = ts.canHaveModifiers(statement)
        ? ts.getModifiers(statement)
        : undefined
      if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
        continue
      if (ts.getJSDocCommentsAndTags(statement).length > 0)
        continue
      const position = sourceFile.getLineAndCharacterOfPosition(
        statement.getStart(sourceFile),
      )
      errors.push(`${file}:${position.line + 1}: exported declaration needs TSDoc`)
    }
  }

  if (errors.length > 0) {
    console.error(`TSDoc coverage failed for ${errors.length} module(s):`)
    console.error(errors.map(error => `- ${error}`).join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`TSDoc module coverage is valid for ${files.length} changed authored TypeScript files`)
}

main()
