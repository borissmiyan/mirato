# Graph Report - ekklesienter  (2026-11-12)

## Corpus Check
- 803 files · ~695,592 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2100 nodes · 2188 edges · 85 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 184 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 126|Community 126]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 268|Community 268]]

## God Nodes (most connected - your core abstractions)
1. `requireGetIntrinsic()` - 29 edges
2. `requireUtils$3()` - 27 edges
3. `AudioService` - 22 edges
4. `executePresentationHotkeys()` - 18 edges
5. `requireSafer()` - 17 edges
6. `RelayTransmitterService` - 17 edges
7. `requireResponse()` - 16 edges
8. `RemoteServer` - 16 edges
9. `RemoteServer` - 16 edges
10. `requireSend()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `requireResponse()` --calls--> `send()`  [INFERRED]
  dist-electron/main.js → electron/preload.ts
- `ensureLayers()` --calls--> `async()`  [INFERRED]
  src/core/utils/styleMigration.ts → src/features/presenter/components/slide-properties/SlideDesignBackgroundTab.tsx
- `ensureLayers()` --calls--> `TimerFillPicker()`  [INFERRED]
  src/core/utils/styleMigration.ts → src/features/presenter/components/slide-properties/TimerFillPicker.tsx
- `ensureLayers()` --calls--> `async()`  [INFERRED]
  src/core/utils/styleMigration.ts → src/features/presenter/components/SlideDesignPanel.tsx
- `useLogoUrl()` --calls--> `useControllerLogic()`  [INFERRED]
  src/core/hooks/useLogoUrl.ts → src/app/hooks/useControllerLogic.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (210): copyRecursive(), createMainWindow(), createProjectorWindow(), createStageWindow(), getPreloadPath(), initHymnDirectoriesAndMigration(), initMediaDirectories(), registerHymnHandlers() (+202 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (39): alignCanvasSelection(), calculateOpacityFromKey(), calculateZoomToSelection(), copyCanvasStyleFromSelection(), distributeCanvasSelection(), flattenSelectedShapes(), flipCanvasSelection(), groupOrUngroupSelection() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (22): handleSelectKeyword(), handleSelectReference(), handleImportService(), handleRenameService(), handleSaveCurrentRename(), handleDelete(), handleMoveToBin(), handleMoveToRoot() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (36): getItemNormalizedPath(), getMaskItemPath(), getLineAngleAndLength(), getNormalizedShapePath(), getShapePathData(), snapAngleToStep(), ShapeRenderer(), evaluateCubicBezier() (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (24): MultiVerseDisplay(), ParallelVerseDisplay(), VerseDisplay(), findTopics(), ScriptureDatabase, useTextFit(), getBookName(), cleanText() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (13): fadeOutTrack(), rampGain(), getTrackProgress(), pauseTrack(), seekBufferSourceTrack(), findActiveScope(), AudioService, resolveHymnAudioScopes() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (8): getAvailableLocalIps(), getMainWindow(), MediaProxyHandler, RemoteAuthManager, RemoteServer, selectBestLocalIp(), UdpDiscoveryService, WebSocketRelayHandler

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (23): applyBlendMode(), clamp01(), clipColor(), compositeOver(), cssToLinearRGBA(), findOcclusionCutoff(), getComputedColor(), hex2() (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (9): AudioBufferLoader, computeInstantUrl(), getLocalResourceUrl(), handleDuplicate(), LibraryImportService, MediaExportService, generateWaveformPoints(), getUniquePresentationName() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (12): handleRelink(), collectMediaRefs(), extractPathFromLocalResource(), getMediaBlob(), patchMediaIds(), readLocalFileSafe(), MediaPersistenceService, MediaRelinkService (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (6): async(), ThumbnailService, async(), TimerFillPicker(), ensureLayers(), migrateBackgroundToLayers()

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (3): RemoteServer, getAvailableLocalIps(), selectBestLocalIp()

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (9): useAppInitialization(), useAudioSync(), useAudioSyncData(), useControllerLogic(), useControllerRemoteSync(), useGlobalShortcuts(), useLogoUrl(), useProjectorLifecycleSync() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (1): RelayTransmitterService

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (11): resolveBackground(), getRels(), resolveRel(), processPic(), getInheritedShape(), processShape(), getAttr(), parseFormatting() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.26
Nodes (17): require_stream_duplex(), require_stream_passthrough(), require_stream_readable(), require_stream_transform(), require_stream_writable(), requireBufferList(), requireDestroy(), requireInherits() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (16): requireAdler32(), requireCommon$1(), requireConstants$1(), requireCrc32(), requireDeflate(), requireDeflate$1(), requireGzheader(), requireInffast() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (8): fetchSystemFonts(), fetchStyles(), getBundledWeights(), getSystemFontData(), getSystemFonts(), needsFauxBold(), normalizeFontStyle(), fetchStyles()

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (7): handleBlur(), handleKeyDown(), handlePaste(), applyBlockStyle(), normalizeHtml(), stripInlineStyleProp(), sanitizePasteHtml()

### Community 19 - "Community 19"
Cohesion: 0.28
Nodes (11): checkBotHardcodedTokens(), checkClientSecretExposure(), checkFrontendIdorLeaks(), checkHardcodedSecretFallbacks(), checkPublicAnonIdor(), checkRlsPrivilegeEscalation(), checkTmaBotSecretExposure(), checkTmaInitDataBypass() (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (3): ResizeHandle(), getCursorForCorner(), getRotateAngle()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (8): checkComponentBudget(), collectTargetFiles(), countCleanLines(), getStagedFiles(), isTargetFile(), loadExceptions(), readFromGitIndex(), verifyComponentBudget()

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (4): createMainWindow(), createProjectorWindow(), createStageWindow(), getPreloadPath()

### Community 23 - "Community 23"
Cohesion: 0.31
Nodes (8): invoke(), on(), onAspectRatioChanged(), readDirectoryRecursive(), readFileData(), selectFile(), selectFolder(), send()

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (1): WebSocketRelayHandler

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (5): useTemplatePickerActions(), useTemplatePickerBlockManager(), useTemplatePickerDeletion(), useTemplatePickerNaming(), useTemplatePickerProperties()

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (1): CanvasService

### Community 27 - "Community 27"
Cohesion: 0.44
Nodes (1): MediaCache

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (3): FontInstallerService, loadFontOffline(), resolveFontFamily()

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (4): copyRecursive(), initHymnDirectoriesAndMigration(), seedBundledHymnals(), registerHymnHandlers()

### Community 30 - "Community 30"
Cohesion: 0.36
Nodes (5): calculateCanvasEdgeDistances(), calculateItemToItemDistances(), getItemBounds(), getItemDOMBounds(), detectEqualSpacing()

### Community 31 - "Community 31"
Cohesion: 0.39
Nodes (6): fetchDisplays(), setPresenterDisplay(), setPreviewDisplay(), setStageDisplay(), toggleAutoDefine(), updateDisplay()

### Community 32 - "Community 32"
Cohesion: 0.32
Nodes (4): useSlideTransitionManager(), getTransitionVariables(), normalizeTransitionDirection(), normalizeTransitionType()

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (2): calculateContrastRatio(), getRelativeLuminance()

### Community 36 - "Community 36"
Cohesion: 0.48
Nodes (1): FFmpegService

### Community 37 - "Community 37"
Cohesion: 0.43
Nodes (1): WebRtcRelayService

### Community 39 - "Community 39"
Cohesion: 0.38
Nodes (3): handleFileSelect(), if(), updateLayer()

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (2): walk(), SilentSuccessReporter

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (1): MediaProxyHandler

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (2): handleSelect(), findOverlappingScopes()

### Community 45 - "Community 45"
Cohesion: 0.53
Nodes (4): calculateStyleUpdates(), extractColorsFromHtml(), getStyleHash(), normalizeColor()

### Community 47 - "Community 47"
Cohesion: 0.4
Nodes (2): findLogo(), handleCommand()

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (3): useVideoPlayback(), useVideoStateSync(), useVideoVolumeSync()

### Community 50 - "Community 50"
Cohesion: 0.4
Nodes (2): handleSaveClick(), performSave()

### Community 52 - "Community 52"
Cohesion: 0.4
Nodes (2): handleSelectChapter(), handleSelectTranslation()

### Community 53 - "Community 53"
Cohesion: 0.7
Nodes (4): copyDirectoryRecursiveSync(), countFilesRecursive(), migrateFromEkklesienterIfNeeded(), safeCopyFileSync()

### Community 54 - "Community 54"
Cohesion: 0.4
Nodes (1): RemoteAuthManager

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (1): UdpDiscoveryService

### Community 58 - "Community 58"
Cohesion: 0.4
Nodes (1): MockResizeObserver

### Community 59 - "Community 59"
Cohesion: 0.5
Nodes (2): getBookSection(), getSectionColors()

### Community 60 - "Community 60"
Cohesion: 0.4
Nodes (1): ScreenCaptureService

### Community 64 - "Community 64"
Cohesion: 0.6
Nodes (3): clamp(), getPolygonCornerHandles(), getStarCornerHandles()

### Community 66 - "Community 66"
Cohesion: 0.4
Nodes (1): MockResizeObserver

### Community 71 - "Community 71"
Cohesion: 0.4
Nodes (2): onKeyDown(), handleDone()

### Community 74 - "Community 74"
Cohesion: 0.4
Nodes (2): useRemoteLifecycleSync(), useRemoteSocket()

### Community 75 - "Community 75"
Cohesion: 0.83
Nodes (3): main(), runCommand(), sleep()

### Community 78 - "Community 78"
Cohesion: 0.5
Nodes (2): useIntersection(), SlideTile()

### Community 79 - "Community 79"
Cohesion: 0.67
Nodes (1): AutoBackupService

### Community 80 - "Community 80"
Cohesion: 0.5
Nodes (2): App(), useWakeLock()

### Community 85 - "Community 85"
Cohesion: 0.5
Nodes (2): useCanvasActions(), useCanvasShortcuts()

### Community 87 - "Community 87"
Cohesion: 0.5
Nodes (2): useAudioScopeDrag(), useAudioScopeResize()

### Community 88 - "Community 88"
Cohesion: 0.5
Nodes (2): useTimelineAutoScroll(), useTimelineDragAndDrop()

### Community 91 - "Community 91"
Cohesion: 0.5
Nodes (2): useMetadata(), useSlideDisplayData()

### Community 92 - "Community 92"
Cohesion: 0.5
Nodes (1): MediaCleanerService

### Community 94 - "Community 94"
Cohesion: 0.5
Nodes (1): BibleNavigationService

### Community 95 - "Community 95"
Cohesion: 0.83
Nodes (3): handleCancel(), handleConfirm(), handleKeyDown()

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (2): main(), walk_source_files()

### Community 102 - "Community 102"
Cohesion: 1.0
Nodes (2): runCommand(), verifyDiffBudget()

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (2): getAllComponentFiles(), verifyMemoization()

### Community 104 - "Community 104"
Cohesion: 1.0
Nodes (2): getAllFiles(), verifyResourceHygiene()

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (2): runCommand(), verifyNoCircular()

### Community 106 - "Community 106"
Cohesion: 1.0
Nodes (2): runCommand(), verifyNoDebugLeftovers()

### Community 107 - "Community 107"
Cohesion: 1.0
Nodes (2): runCommand(), verifySchemaDrift()

### Community 108 - "Community 108"
Cohesion: 1.0
Nodes (2): runCommand(), verifyNoLargeFiles()

### Community 110 - "Community 110"
Cohesion: 1.0
Nodes (2): harnessRollback(), run()

### Community 111 - "Community 111"
Cohesion: 1.0
Nodes (2): runCommand(), verifyHarnessIntegrity()

### Community 112 - "Community 112"
Cohesion: 1.0
Nodes (2): initMediaDirectories(), registerMediaHandlers()

### Community 113 - "Community 113"
Cohesion: 0.67
Nodes (1): ZefaniaParser

### Community 126 - "Community 126"
Cohesion: 1.0
Nodes (2): handleFontSelect(), updateLabel()

### Community 131 - "Community 131"
Cohesion: 0.67
Nodes (1): VideoThumbnailService

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (2): copyHymnAudioScopes(), performAddHymnToActivePresentation()

### Community 139 - "Community 139"
Cohesion: 1.0
Nodes (2): handleClose(), handleDeleteScope()

### Community 140 - "Community 140"
Cohesion: 1.0
Nodes (2): handleClose(), handleConfirm()

### Community 142 - "Community 142"
Cohesion: 1.0
Nodes (2): cn(), switch()

### Community 268 - "Community 268"
Cohesion: 1.0
Nodes (1): MockEyeDropper

## Knowledge Gaps
- **1 isolated node(s):** `MockEyeDropper`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 13`** (18 nodes): `RelayTransmitterService`, `.cleanupHeartbeat()`, `.cleanupReconnect()`, `.connect()`, `.constructor()`, `.disconnect()`, `.getHost()`, `.getInstance()`, `.getIsConnected()`, `.getPin()`, `.notifyListeners()`, `.onPrivacy()`, `.onSignal()`, `.sendProjectorCommand()`, `.sendSignal()`, `.setPrivacy()`, `.subscribe()`, `RelayTransmitterService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (10 nodes): `WebSocketRelayHandler.ts`, `WebSocketRelayHandler`, `.broadcast()`, `.broadcastExcept()`, `.clientCount()`, `.constructor()`, `.disconnectClients()`, `.handleAuthenticatedMessage()`, `.setup()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (10 nodes): `CanvasService`, `.calculateCropResult()`, `.calculateDimensionScale()`, `.calculatePivotTransformation()`, `.calculateRadiusUpdates()`, `.clampCropOffset()`, `.getAlignmentUpdates()`, `.getAnchorPositionUpdates()`, `.getSelectionState()`, `CanvasService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (9 nodes): `mediaCache.ts`, `MediaCache`, `.clear()`, `.delete()`, `.evictOldest()`, `.getBackgroundUrl()`, `.put()`, `.release()`, `.triggerProxyGeneration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (7 nodes): `calculateContrastRatio()`, `findDocFile()`, `getRelativeLuminance()`, `getStagedFiles()`, `hexToRgb()`, `verify-design-system.mjs`, `scanFiles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (7 nodes): `FFmpegService`, `.generateProxy()`, `.generateProxyById()`, `.load()`, `.trimMedia()`, `.trimMediaById()`, `ffmpegService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (7 nodes): `WebRtcRelayService`, `.cleanup()`, `.createPeerConnection()`, `.handleSignal()`, `.initReceiver()`, `.initSender()`, `WebRtcRelayService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (6 nodes): `walk()`, `find_i18n_issues.js`, `silent-reporter.mjs`, `SilentSuccessReporter`, `.onInit()`, `.onTestRunEnd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (6 nodes): `MediaProxyHandler.ts`, `MediaProxyHandler`, `.clear()`, `.constructor()`, `.handleResponse()`, `.handleRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (6 nodes): `handleConfirm()`, `handleImport()`, `handleSelect()`, `AudioPickerModal.tsx`, `timelineUtils.ts`, `findOverlappingScopes()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (6 nodes): `findLogo()`, `handleCommand()`, `handleDoubleClick()`, `handleKeyDown()`, `reportRatio()`, `ProjectorView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (6 nodes): `handleConfirmUsageSave()`, `handleCustomizeThisSlideOnlyClick()`, `handleDiscard()`, `handleSaveClick()`, `performSave()`, `HymnDesignSettings.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (6 nodes): `handleProjectSelected()`, `handleSelectBook()`, `handleSelectChapter()`, `handleSelectTranslation()`, `toggleVerse()`, `BibleBrowser.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (5 nodes): `RemoteAuthManager.ts`, `RemoteAuthManager`, `.clear()`, `.generateNewPin()`, `.validateAttempt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (5 nodes): `UdpDiscoveryService.ts`, `UdpDiscoveryService`, `.constructor()`, `.start()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (5 nodes): `MockResizeObserver`, `.disconnect()`, `.observe()`, `.unobserve()`, `useTextFit.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (5 nodes): `getBookName()`, `getBookOrder()`, `getBookSection()`, `getSectionColors()`, `bookData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (5 nodes): `ScreenCaptureService`, `.getSources()`, `.startCapture()`, `.stopStream()`, `ScreenCaptureService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (5 nodes): `MockResizeObserver`, `.disconnect()`, `.observe()`, `.unobserve()`, `HymnPickerModal.test.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (5 nodes): `onKeyDown()`, `handleCancel()`, `handleDone()`, `CanvasVectorEditor.tsx`, `CustomizationPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (5 nodes): `useRemoteLifecycleSync()`, `getWsUrl()`, `useRemoteSocket()`, `useRemoteLifecycleSync.ts`, `useRemoteSocket.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (4 nodes): `useIntersection()`, `useIntersection.ts`, `SlideTile.tsx`, `SlideTile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (4 nodes): `AutoBackupService`, `.createSnapshot()`, `.runScheduledBackup()`, `autoBackupService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (4 nodes): `App()`, `useWakeLock()`, `App.tsx`, `useWakeLock.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (4 nodes): `useCanvasActions()`, `useCanvasShortcuts()`, `useCanvasActions.ts`, `useCanvasShortcuts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (4 nodes): `useAudioScopeDrag()`, `useAudioScopeResize()`, `useAudioScopeDrag.ts`, `useAudioScopeResize.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (4 nodes): `useTimelineAutoScroll()`, `useTimelineDragAndDrop()`, `useTimelineAutoScroll.ts`, `useTimelineDragAndDrop.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (4 nodes): `useMetadata()`, `useSlideDisplayData()`, `useMetadata.ts`, `useSlideDisplayData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (4 nodes): `MediaCleanerService`, `.deleteOrphans()`, `.scanOrphans()`, `MediaCleanerService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (4 nodes): `BibleNavigationService`, `.getNextVerse()`, `.getPrevVerse()`, `BibleNavigationService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (3 nodes): `main()`, `walk_source_files()`, `find_i18n_issues.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (3 nodes): `verify-diff-budget.mjs`, `runCommand()`, `verifyDiffBudget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (3 nodes): `getAllComponentFiles()`, `verify-memoization.mjs`, `verifyMemoization()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (3 nodes): `getAllFiles()`, `verify-resource-hygiene.mjs`, `verifyResourceHygiene()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (3 nodes): `verify-no-circular.mjs`, `runCommand()`, `verifyNoCircular()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (3 nodes): `verify-no-debug-leftovers.mjs`, `runCommand()`, `verifyNoDebugLeftovers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (3 nodes): `verify-schema-drift.mjs`, `runCommand()`, `verifySchemaDrift()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (3 nodes): `verify-no-large-files.mjs`, `runCommand()`, `verifyNoLargeFiles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (3 nodes): `harnessRollback()`, `harness-rollback.mjs`, `run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (3 nodes): `verify-no-test-tampering.mjs`, `runCommand()`, `verifyHarnessIntegrity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (3 nodes): `mediaHandlers.ts`, `initMediaDirectories()`, `registerMediaHandlers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (3 nodes): `ZefaniaParser`, `.parse()`, `zefaniaParser.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (3 nodes): `handleFontSelect()`, `updateLabel()`, `TranslationLabelPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (3 nodes): `VideoThumbnailService`, `.captureVideoThumbnail()`, `VideoThumbnailService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (3 nodes): `copyHymnAudioScopes()`, `performAddHymnToActivePresentation()`, `hymnAddOperation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (3 nodes): `handleClose()`, `handleDeleteScope()`, `OrphanAudioScopesModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (3 nodes): `handleClose()`, `handleConfirm()`, `RemoveHymnalModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 142`** (3 nodes): `NavigationSelectorCard.tsx`, `cn()`, `switch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 268`** (2 nodes): `MockEyeDropper`, `useEyeDropper.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `require_stream_readable()` connect `Community 15` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `executePresentationHotkeys()` (e.g. with `tidyUpItems()` and `copyCanvasStyleFromSelection()`) actually correct?**
  _`executePresentationHotkeys()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MockEyeDropper` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._