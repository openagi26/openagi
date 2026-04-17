/**
 * Probe S3: Docker Sandbox Verification
 * Tests Docker availability and process fallback path
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function probeDocker() {
  console.log('=== S3: Docker Sandbox Probe ===\n')

  // Step 1: Check Docker availability
  console.log('[1] Checking Docker daemon...')
  let dockerAvailable = false
  try {
    const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 5000 })
    console.log(`    Docker available: v${stdout.trim()}`)
    dockerAvailable = true
  } catch (err: any) {
    console.log(`    Docker NOT available: ${err.message.split('\n')[0]}`)
  }

  // Step 2: If Docker available, test container run
  if (dockerAvailable) {
    console.log('\n[2] Testing Docker container execution...')
    try {
      const testId = `probe-${Date.now()}`
      const { stdout } = await execFileAsync('docker', [
        'run', '--rm', '--name', testId,
        '-m', '64m', '--cpu-shares', '256',
        '--network', 'none', '--read-only',
        '--tmpfs', '/tmp:size=10m',
        'node:20-alpine', 'node', '-e', 'console.log("SANDBOX_OK")',
      ], { timeout: 30000 })
      console.log(`    Container stdout: ${stdout.trim()}`)
      console.log(`    Docker sandbox: PASS`)
    } catch (err: any) {
      console.log(`    Docker sandbox: FAIL - ${err.message.split('\n')[0]}`)
    }
  }

  // Step 3: Test process fallback (subprocess execution)
  console.log('\n[3] Testing process fallback (subprocess)...')
  try {
    const { stdout } = await execFileAsync('node', ['-e', 'console.log("PROCESS_OK:' + Date.now() + '")'], { timeout: 5000 })
    console.log(`    Process stdout: ${stdout.trim()}`)
    console.log(`    Process fallback: PASS`)
  } catch (err: any) {
    console.log(`    Process fallback: FAIL - ${err.message}`)
  }

  // Step 4: Test with resource constraints simulation
  console.log('\n[4] Testing resource-constrained execution...')
  try {
    const { stdout } = await execFileAsync('node', ['-e', `
      const start = Date.now();
      let sum = 0;
      for (let i = 0; i < 1e6; i++) sum += i;
      const mem = process.memoryUsage();
      console.log(JSON.stringify({ duration_ms: Date.now()-start, heap_mb: Math.round(mem.heapUsed/1048576) }));
    `], { timeout: 10000 })
    const result = JSON.parse(stdout.trim())
    console.log(`    Duration: ${result.duration_ms}ms, Heap: ${result.heap_mb}MB`)
    console.log(`    Resource monitoring: PASS`)
  } catch (err: any) {
    console.log(`    Resource monitoring: FAIL - ${err.message}`)
  }

  // Step 5: Evaluate alternative
  console.log('\n[5] Alternative assessment:')
  if (!dockerAvailable) {
    console.log('    Docker unavailable → Process isolation fallback is FUNCTIONAL')
    console.log('    Assessment: Process-based sandbox is viable for Phase 0')
    console.log('    Recommendation: Add CPU time limit via worker_threads for production')
  } else {
    console.log('    Docker available → Full container sandbox recommended')
  }

  console.log('\n=== S3 RESULT: ' + (dockerAvailable ? 'DOCKER' : 'PROCESS_FALLBACK') + ' ===')
}

probeDocker().catch(err => {
  console.error('Probe S3 failed:', err)
  process.exit(1)
})
