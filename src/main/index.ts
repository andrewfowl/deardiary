import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { JournalDb } from './db'
import { SettingsStore } from './settings'
import { CaptureService } from './capture'
import { AnalysisPipeline } from './pipeline'
import { StatusBus } from './status'
import { registerIpc } from './ipc'
import { isProviderConfigured } from './ai/provider'
import { evaluateLicense, isRecordingAllowed } from './license'
import { TRAY_ICON_DATA_URL } from './trayIcon'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(init)
}

function init(): void {
  const userData = app.getPath('userData')
  const settings = new SettingsStore(userData)
  const db = new JournalDb(join(userData, 'deardiary.db'))
  const status = new StatusBus()

  // The 14-day trial starts the first time the app runs.
  if (settings.get().trialStartTs === 0) {
    settings.update({ trialStartTs: Date.now() })
  }
  const licenseNow = (): ReturnType<typeof evaluateLicense> => {
    const s = settings.get()
    return evaluateLicense(s.licenseKey || null, s.trialStartTs)
  }
  const allowed = (): boolean => isRecordingAllowed(licenseNow())

  const capture = new CaptureService(
    db,
    settings,
    join(userData, 'screenshots'),
    allowed,
    (patch) => status.update(patch)
  )
  const pipeline = new AnalysisPipeline(db, settings, allowed, (patch) => status.update(patch))

  status.update({
    paused: settings.get().paused,
    providerConfigured: isProviderConfigured(settings.get()),
    pendingScreenshots: 0,
    license: licenseNow()
  })
  // Keep the trial countdown / expiry state fresh while the app runs.
  setInterval(() => status.update({ license: licenseNow() }), 60_000)

  registerIpc(db, settings, pipeline, status)
  createWindow(status)
  createTray(settings, status)

  capture.start()
  pipeline.start()

  app.on('before-quit', () => {
    quitting = true
    capture.stop()
    pipeline.stop()
    db.close()
  })

  app.on('activate', () => showWindow())
  app.on('window-all-closed', () => {
    // Keep running in the tray on Windows; recording continues.
  })
}

function createWindow(status: StatusBus): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101318',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  status.attach(mainWindow)
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function createTray(settings: SettingsStore, status: StatusBus): void {
  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL))
  tray.setToolTip('DearDiary — automatic work journal')
  tray.on('double-click', () => showWindow())

  const rebuild = (): void => {
    const paused = settings.get().paused
    tray?.setToolTip(paused ? 'DearDiary — paused' : 'DearDiary — recording your work journal')
    const menu = Menu.buildFromTemplate([
      { label: 'Open DearDiary', click: () => showWindow() },
      {
        label: paused ? 'Resume recording' : 'Pause recording',
        click: () => {
          const next = !settings.get().paused
          settings.update({ paused: next })
          status.update({ paused: next })
          rebuild()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
    tray?.setContextMenu(menu)
  }
  rebuild()
}
