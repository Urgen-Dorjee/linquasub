import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'

interface PythonManagerOptions {
  port: number
  appPath: string
  isPackaged: boolean
  resourcesPath: string
  ffmpegPath: string | null
}

export class PythonManager {
  private process: ChildProcess | null = null
  private options: PythonManagerOptions
  private maxRetries = 3
  private retryCount = 0

  constructor(options: PythonManagerOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { cmd, args, cwd } = this.getCommand()
      const env = {
        ...process.env,
        BACKEND_PORT: String(this.options.port),
        FFMPEG_PATH: this.options.ffmpegPath ?? '',
        KMP_DUPLICATE_LIB_OK: 'TRUE',
        ...(this.options.isPackaged ? { LINGUASUB_PACKAGED: '1' } : {}),
      }

      console.log(`[PythonManager] Starting: ${cmd} ${args.join(' ')}`)
      console.log(`[PythonManager] CWD: ${cwd || 'default'}`)

      this.process = spawn(cmd, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        ...(cwd ? { cwd } : {}),
      })

      this.process.stdout?.on('data', (data) => {
        console.log(`[Python] ${data.toString().trim()}`)
      })

      this.process.stderr?.on('data', (data) => {
        console.error(`[Python] ${data.toString().trim()}`)
      })

      this.process.on('error', (err) => {
        console.error(`[PythonManager] Process error:`, err)
        reject(new Error(`Failed to start Python backend: ${err.message}`))
      })

      this.process.on('exit', (code) => {
        console.log(`[PythonManager] Process exited with code ${code}`)
        if (code !== 0 && this.retryCount < this.maxRetries) {
          this.retryCount++
          console.log(`[PythonManager] Retrying (${this.retryCount}/${this.maxRetries})...`)
          this.start().then(resolve).catch(reject)
        }
      })

      this.waitForHealth(30000)
        .then(() => {
          console.log('[PythonManager] Backend is healthy')
          resolve()
        })
        .catch((err) => {
          this.stop()
          reject(err)
        })
    })
  }

  stop(): void {
    if (this.process) {
      console.log('[PythonManager] Stopping Python backend...')
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
      this.process = null
    }
  }

  private getCommand(): { cmd: string; args: string[]; cwd?: string } {
    if (this.options.isPackaged) {
      // Production: use standalone Python bundled in resources/backend/python/
      const backendDir = path.join(this.options.resourcesPath, 'backend')
      const pythonExe = path.join(backendDir, 'python', 'python.exe')
      const mainPy = path.join(backendDir, 'main.py')
      return {
        cmd: pythonExe,
        args: [mainPy, '--port', String(this.options.port)],
        cwd: backendDir,
      }
    }

    // In dev mode, appPath may point to dist-electron/ after build.
    // We need the project root to find backend/main.py
    let projectRoot = this.options.appPath
    if (projectRoot.endsWith('dist-electron') || projectRoot.endsWith('dist-electron/') || projectRoot.endsWith('dist-electron\\')) {
      projectRoot = path.dirname(projectRoot)
    }
    // Also handle if appPath is inside dist-electron
    if (!require('fs').existsSync(path.join(projectRoot, 'backend', 'main.py'))) {
      // Walk up until we find it
      let candidate = projectRoot
      for (let i = 0; i < 3; i++) {
        candidate = path.dirname(candidate)
        if (require('fs').existsSync(path.join(candidate, 'backend', 'main.py'))) {
          projectRoot = candidate
          break
        }
      }
    }

    const backendPath = path.join(projectRoot, 'backend', 'main.py')
    // Try venv first, then system python
    const venvPython = path.join(projectRoot, 'backend', 'venv', 'Scripts', 'python.exe')
    const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python'

    return {
      cmd: pythonCmd,
      args: [backendPath, '--port', String(this.options.port)],
    }
  }

  private waitForHealth(timeoutMs: number): Promise<void> {
    const startTime = Date.now()
    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Python backend failed to start within timeout'))
          return
        }

        const req = http.get(
          `http://127.0.0.1:${this.options.port}/api/health`,
          (res) => {
            if (res.statusCode === 200) {
              resolve()
            } else {
              setTimeout(check, 500)
            }
          }
        )

        req.on('error', () => {
          setTimeout(check, 500)
        })

        req.setTimeout(2000, () => {
          req.destroy()
          setTimeout(check, 500)
        })
      }

      check()
    })
  }
}
