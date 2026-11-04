# PROJECT SPECIFICATION
# Professional Video Editor – Product Enhancement & Commercial Launch

**Project Type:** Existing product enhancement and website development  
**Project Manager:** PM Agent  
**Development Agents:** Backend, Frontend, Tester, and other available specialized agents  
**Primary Technologies:** TypeScript, Node.js, Angular, Tailwind CSS  
**Project Status:** Existing application – enhancement and expansion  
**Delivery Strategy:** Incremental development with continuous testing and integration

---

# 1. Project Vision

Transform the existing simple video editor into a professional, feature-rich video editing application suitable for content creators, social media managers, marketers, small businesses, and other video production users.

In parallel, create a modern, professional product website that introduces the application to potential customers, showcases its capabilities, demonstrates its interface, and encourages visitors to try or purchase the product.

The final result should feel like a complete commercial software product, not simply a collection of editing tools.

The project consists of two interconnected products:

1. **Video Editor Application:** The actual editing software, enhanced with professional editing capabilities.
2. **Product Landing Page and Showcase:** A public-facing website designed to present, promote, and demonstrate the video editor.

Both products must share a consistent visual identity and communicate the same product positioning.

# 2. Primary Objectives

## Objective A – Enhance the Existing Video Editor

Improve the existing application by introducing professional editing capabilities while preserving the existing functionality.

The editor should provide:

- An intuitive editing workflow.
- A professional-looking editing interface.
- A multi-track timeline.
- Advanced clip manipulation.
- Audio editing.
- Text and title editing.
- Visual effects and transitions.
- Video transformations.
- Professional export options.
- Project management.
- A reliable preview and rendering workflow.

The editor should remain accessible to beginners while providing enough flexibility for more experienced creators.

## Objective B – Create a Product Landing Page

Build a high-quality marketing website that:

- Introduces the video editor.
- Communicates its value proposition.
- Highlights its most important features.
- Demonstrates the editing interface.
- Presents example editing workflows.
- Displays screenshots, animations, and product videos.
- Explains supported capabilities and technical requirements.
- Encourages visitors to try the application or request access.
- Provides a clear path for future commercial offerings.

## Objective C – Prepare the Product for Commercial Presentation

Make the product suitable for demonstrations to potential customers and stakeholders.

This includes:

- Consistent branding.
- Professional UI/UX.
- Reliable application workflows.
- Product documentation.
- Demonstration projects.
- Realistic product screenshots.
- A polished landing page.
- Clear product positioning.
- A stable release candidate.

Do not invent pricing, customer testimonials, product claims, or commercial capabilities that have not been approved or implemented.

# 3. Initial Project Discovery – Mandatory

Before implementing anything, the PM Agent must coordinate a complete review of the existing application.

**Do not start by rebuilding the editor.**

The first milestone is understanding what already exists.

## 3.1 Codebase Analysis

The PM Agent must inspect:

- Existing project structure.
- Frontend framework and version.
- Backend framework and version.
- Existing database, if any.
- Current video processing technology.
- Existing video preview implementation.
- Existing editing functionality.
- Existing timeline implementation.
- File import and export mechanisms.
- Current application architecture.
- Dependencies and external libraries.
- Existing authentication and user management.
- Build and deployment configuration.

## 3.2 Existing Feature Inventory

Create an inventory of existing functionality.

For every feature, classify it as:

- Implemented and working.
- Implemented but incomplete.
- Implemented but requiring improvement.
- Not implemented.
- Broken or unreliable.
- Requires architectural changes.

## 3.3 Technical Feasibility Assessment

The PM Agent must request a technical assessment from the Backend and Frontend agents.

Special attention must be given to:

- Video decoding and encoding.
- Browser-based media processing capabilities.
- Timeline synchronization.
- Preview performance.
- Large media file handling.
- Audio/video synchronization.
- Memory consumption.
- Export performance.
- Supported codecs and formats.
- Cross-browser compatibility, if applicable.

Evaluate the existing media engine before selecting or replacing any processing technology.

Possible technologies to evaluate, depending on the existing architecture, include FFmpeg, FFmpeg.wasm, WebCodecs, HTMLMediaElement, Canvas, and Web Audio API.

Do not introduce multiple competing media processing engines without a clear architectural reason.

## 3.4 Discovery Deliverables

The PM Agent must produce:

1. Existing architecture overview.
2. Existing feature inventory.
3. Technical debt report.
4. Performance and reliability assessment.
5. Missing functionality list.
6. Recommended implementation architecture.
7. Prioritized development roadmap.
8. Initial task breakdown for all working agents.

No major architectural replacement should happen before this assessment is reviewed.

# 4. Product A – Professional Video Editor

## 4.1 Editing Workspace

Improve the existing editing workspace to provide a professional editing experience.

The interface should contain the following logical areas:

- Main application toolbar.
- Project navigation.
- Media/assets library.
- Video preview monitor.
- Editing timeline.
- Properties and inspector panel.
- Export controls.
- Contextual editing controls.

The layout should be configurable where practical.

### Requirements

- Provide a clean, modern editing workspace.
- Use consistent icons and controls.
- Support resizable panels where practical.
- Provide clear selection states.
- Display useful tooltips.
- Support dark mode if compatible with the existing design.
- Maintain responsive behavior appropriate to the application.
- Prevent accidental loss of editing work.

The editing workspace should prioritize desktop usability because professional video editing requires significant screen space.

## 4.2 Media Library and Asset Management

Enhance media import and organization.

Required functionality:

- Import video files.
- Import audio files.
- Import images.
- Display media thumbnails.
- Display media duration.
- Display file information.
- Organize media into folders or collections.
- Search and filter assets.
- Rename assets where appropriate.
- Remove assets from projects.
- Detect unsupported media formats.
- Display media loading and processing states.

Additional capabilities to evaluate:

- Thumbnail generation.
- Waveform generation.
- Media metadata extraction.
- Proxy media for large files.
- Drag-and-drop importing.

Do not silently delete original media files when removing them from a project.

## 4.3 Professional Timeline Editing

<badge color="success">High priority</badge>

The timeline is one of the most important parts of the product.

Enhance it to support professional editing workflows.

### Core timeline functionality

- Multiple video tracks.
- Multiple audio tracks.
- Timeline zoom.
- Timeline scrolling.
- Playhead navigation.
- Timecode display.
- Clip selection.
- Clip dragging.
- Clip trimming.
- Clip splitting.
- Clip deletion.
- Clip duplication.
- Clip repositioning.
- Track visibility.
- Track locking.
- Track muting.
- Track renaming.
- Snap-to-grid behavior.
- Clip snapping.
- Timeline markers.

### Advanced timeline functionality

- Ripple delete.
- Ripple editing.
- Roll editing where feasible.
- Track grouping.
- Clip linking.
- Audio/video synchronization.
- Clip overlap handling.
- Transition placement.
- Track-level volume.
- Clip-level volume.
- Undo and redo.
- Keyboard shortcuts.

### Timeline acceptance criteria

- Users can create and edit a project with multiple clips.
- Users can arrange clips across multiple tracks.
- Users can trim and split clips accurately.
- The preview reflects timeline changes.
- Audio and video remain synchronized.
- Timeline operations behave consistently.
- Undo and redo restore the expected editing state.

## 4.4 Video Transformations

Implement professional video transformation controls.

Required functionality:

- Crop.
- Resize.
- Scale.
- Position.
- Rotation.
- Horizontal flip.
- Vertical flip.
- Aspect ratio adjustment.
- Fit to frame.
- Fill frame.
- Basic framing controls.

Support common aspect ratios:

- 16:9 – Landscape.
- 9:16 – Vertical video.
- 1:1 – Square.
- 4:5 – Social media portrait.
- Custom aspect ratio.

Users should be able to preview transformations before exporting.

## 4.5 Text and Titles

Implement a text and title editing system.

Required functionality:

- Add text overlays.
- Edit text content.
- Font family selection.
- Font size.
- Font weight.
- Text color.
- Text alignment.
- Text positioning.
- Text background.
- Text outline or shadow.
- Text duration.
- Text animation presets where feasible.

Additional features to evaluate:

- Lower thirds.
- Animated titles.
- Subtitle tracks.
- Caption styling.
- Text templates.
- Reusable title presets.

Text should be editable through a contextual properties panel.

## 4.6 Audio Editing

Introduce a dedicated audio editing workflow.

Required functionality:

- Add audio tracks.
- Import music and sound effects.
- Trim audio clips.
- Split audio clips.
- Adjust volume.
- Fade in.
- Fade out.
- Mute clips.
- Preview audio.
- Display audio waveforms.
- Adjust track volume.

Additional features:

- Audio normalization.
- Basic equalization.
- Noise reduction.
- Audio ducking.
- Audio transitions.
- Multiple audio track mixing.

Advanced audio processing should be prioritized according to technical feasibility.

## 4.7 Transitions and Visual Effects

Introduce a reusable effects and transitions system.

### Transitions

Initial transition library:

- Cut.
- Fade in.
- Fade out.
- Cross dissolve.
- Wipe.
- Slide.
- Zoom.

### Visual effects

Initial effect library:

- Blur.
- Brightness.
- Contrast.
- Saturation.
- Grayscale.
- Vignette.
- Sharpening where feasible.
- Basic color filters.

### Requirements

- Effects should be configurable.
- Users should be able to preview changes.
- Effects should be removable.
- Effect parameters should be saved with the project.
- Effects should render consistently during export.

Do not implement effects as preview-only features that disappear in the exported video.

## 4.8 Color Correction

Introduce a basic color correction panel.

Initial controls:

- Exposure.
- Brightness.
- Contrast.
- Saturation.
- Temperature.
- Tint.
- Highlights.
- Shadows.

Additional capabilities to evaluate:

- Color presets.
- LUT support.
- White balance.
- Advanced color grading.

All adjustments must be represented in the project data and applied consistently to the exported output.

## 4.9 Speed and Playback Controls

Implement:

- Playback speed adjustment.
- Slow motion.
- Fast motion.
- Reverse playback where feasible.
- Frame-by-frame navigation.
- Play/pause.
- Previous/next frame.
- Timeline playback.
- Preview quality settings.

Ensure playback speed changes do not unintentionally alter the original media.

## 4.10 Project Management

Improve project lifecycle management.

Required functionality:

- Create project.
- Open project.
- Save project.
- Save as.
- Rename project.
- Duplicate project.
- Delete project.
- Display project metadata.
- Track project modification date.
- Autosave.
- Recover unsaved work where feasible.

Project files should preserve:

- Timeline structure.
- Tracks.
- Clip positions.
- Clip durations.
- Effects.
- Transitions.
- Audio adjustments.
- Text overlays.
- Export settings.

Define a versioned project data structure to support future compatibility and migrations.

Avoid storing large original video files directly inside project metadata.

## 4.11 Undo and Redo

Implement a reliable editing history system.

Required functionality:

- Undo previous operation.
- Redo previous operation.
- Preserve editing order.
- Handle multiple editing operations.
- Avoid corrupting project state.
- Support appropriate history limits.

Prioritize core editing operations such as trimming, splitting, moving clips, transformations, and property adjustments.

## 4.12 Export and Rendering

<badge color="success">Critical priority</badge>

Export reliability is essential to the product.

Required functionality:

- Export video.
- Select resolution.
- Select frame rate.
- Select output format.
- Configure quality.
- Configure bitrate where supported.
- Display rendering progress.
- Display export errors.
- Allow users to download or save completed output.
- Prevent accidental loss of project data during export.

Initial export presets:

- 720p.
- 1080p.
- 4K, subject to technical feasibility.
- Social media vertical video.

Supported output formats should be determined by the media engine and validated through actual exports.

Potential formats include MP4 and WebM.

### Export acceptance criteria

- Exported videos play correctly in supported players.
- Audio and video remain synchronized.
- Timeline edits are reflected in the output.
- Effects and transitions are preserved.
- Output resolution matches the selected settings.
- Export progress is reported accurately.
- Failed exports produce actionable error messages.

Do not claim 4K, specific codec, or hardware acceleration support unless verified.

## 4.13 Keyboard Shortcuts

Introduce professional editing shortcuts.

Initial examples:

- Space: Play/Pause.
- Ctrl/Cmd + Z: Undo.
- Ctrl/Cmd + Shift + Z: Redo.
- Delete/Backspace: Delete selected clip.
- Ctrl/Cmd + S: Save project.
- S: Split at playhead, if compatible with existing shortcuts.
- Arrow keys: Frame navigation.

Provide a keyboard shortcuts reference accessible from the application.

Avoid conflicts with browser and operating system shortcuts.

# 5. Product B – Landing Page and Product Showcase

## 5.1 Website Vision

Create a modern, visually engaging website that presents the video editor as a serious software product.

The website should communicate:

- What the product does.
- Who it is designed for.
- Why it is useful.
- What makes it different.
- What editing capabilities it provides.
- How potential customers can start using it.

The design should be polished, contemporary, and visually consistent with the editor.

Use Angular and Tailwind CSS according to the established frontend architecture.

## 5.2 Landing Page Structure

### Section 1 – Hero

Create an impactful first impression.

Include:

- Product logo and name.
- Clear headline.
- Short product description.
- Primary call to action.
- Secondary call to action.
- Product interface screenshot or demonstration.
- Visually engaging background.

Example positioning:

"Create Professional Videos. Without the Complexity."

Supporting message:

"An intuitive video editing workspace with powerful tools to help you turn your ideas into professional video content."

Suggested CTA labels:

- Start Creating.
- Explore Features.
- Watch Demo.

These are placeholder marketing messages and should be refined once product positioning is approved.

### Section 2 – Product Showcase

Show the actual application interface.

Include:

- Main editing workspace screenshot.
- Timeline screenshot.
- Effects and transitions showcase.
- Audio editing showcase.
- Export interface showcase.

Use real application screenshots wherever possible.

Do not use misleading mockups that imply functionality that does not exist.

### Section 3 – Key Features

Present the main product capabilities in visually attractive feature sections.

Suggested feature categories:

1. Professional Timeline Editing.
2. Powerful Video Transformations.
3. Creative Text and Titles.
4. Audio Editing.
5. Visual Effects and Transitions.
6. Color Correction.
7. High-Quality Export.
8. Simple Project Management.

Each feature should include:

- Icon or illustration.
- Feature title.
- Short description.
- Supporting visual.
- Optional learn-more interaction.

Only advertise features that are implemented or explicitly marked as upcoming.

### Section 4 – How It Works

Explain the editing workflow.

Suggested steps:

1. Import your media.
2. Arrange clips on the timeline.
3. Customize your video.
4. Add effects, text, and audio.
5. Export your finished video.

Use screenshots or illustrations to communicate each step.

### Section 5 – Use Cases

Show how different users can benefit from the product.

Potential audiences:

- Content creators.
- YouTubers.
- Social media managers.
- Marketing teams.
- Small businesses.
- Educators.
- Freelancers.

Create dedicated use-case cards or sections.

### Section 6 – Product Demonstration

Provide a product demonstration area.

Possible content:

- Demo video.
- Editing workflow recording.
- Interactive product preview.
- Before-and-after examples.

Use actual recordings of the application.

Do not simulate working features with nonfunctional interactive elements.

### Section 7 – Why Choose This Product

Communicate the product's actual advantages.

Potential positioning areas:

- Ease of use.
- Editing flexibility.
- Integrated workflow.
- Creative control.
- Productivity.
- Professional output.

Avoid unsupported comparisons against competing products.

### Section 8 – Pricing or Access

Create a pricing or access section only after the commercial model is decided.

Possible future options:

- Free plan.
- Professional plan.
- Subscription.
- Lifetime license.
- Early access.
- Request a demonstration.

Do not invent prices or imply payment functionality exists.

### Section 9 – FAQ

Provide answers to common questions.

Potential questions:

- What is this video editor?
- Who is it designed for?
- What video formats are supported?
- Can I edit multiple video tracks?
- Can I add music and sound effects?
- Can I export in 1080p or 4K?
- Is the application available on desktop and mobile?
- Is my content stored locally or in the cloud?
- What are the system requirements?

Only publish answers supported by the actual product implementation.

### Section 10 – Final CTA

End the page with a strong call to action.

Encourage visitors to:

- Try the application.
- Request early access.
- Watch the product demonstration.
- Contact the product team.

The CTA should reflect the actual availability of the product.

### Section 11 – Footer

Include:

- Product logo.
- Product description.
- Navigation links.
- Feature links.
- Contact information.
- Privacy policy.
- Terms of service.
- Copyright notice.
- Social media links, if available.

Do not invent contact details or social media accounts.

# 6. Additional Website Pages

Beyond the main landing page, evaluate the following pages:

| Page | Purpose | Priority |
|---|---|---|
| Home | Introduce the product | Critical |
| Features | Explain editing capabilities | High |
| Showcase | Display real product screenshots and demos | High |
| About | Explain the product vision | Medium |
| FAQ | Answer common questions | Medium |
| Contact | Allow potential customers to get in touch | Medium |
| Pricing | Present commercial plans | Future |
| Privacy | Explain data handling | Required before public launch |
| Terms | Define product usage terms | Required before public launch |

The PM agent should determine whether these should be separate routes or sections of a single landing page.

Avoid creating unnecessary pages before the core marketing experience is complete.

# 7. Visual Identity and Design Direction

Both the editor and the marketing website should share a consistent design language.

The design should communicate:

- Professionalism.
- Creativity.
- Simplicity.
- Precision.
- Reliability.
- Modern software design.

### Design requirements

- Consistent typography.
- Consistent spacing.
- Defined color palette.
- Consistent iconography.
- Reusable UI components.
- Clear visual hierarchy.
- Responsive layouts.
- Accessible contrast.
- Smooth but restrained animations.

The PM agent should coordinate the design direction with the Frontend Agent.

Do not redesign the existing editor unnecessarily if it already has a recognizable and coherent visual identity.

# 8. Technical Architecture and Agent Responsibilities

The PM Agent is responsible for the overall architecture and coordination.

## 8.1 PM Agent

Responsibilities:

- Analyze the existing project.
- Define implementation priorities.
- Maintain the product roadmap.
- Break down work into tasks.
- Delegate tasks.
- Define acceptance criteria.
- Coordinate dependencies.
- Monitor progress.
- Review deliverables.
- Coordinate integration.
- Approve final delivery.

The PM agent must not implement all features itself.

## 8.2 Backend Agent

Primary responsibilities:

- Analyze existing backend architecture.
- Improve media processing infrastructure where required.
- Implement project persistence.
- Implement media metadata handling.
- Implement file management.
- Implement export/rendering workflows.
- Implement relevant APIs.
- Handle authentication if required.
- Implement secure file handling.
- Optimize backend performance.
- Implement backend tests.

Important: First determine whether the existing editor processes video locally in the browser or through a backend. Do not introduce backend media processing simply because a backend agent is available.

## 8.3 Frontend Agent

Primary responsibilities:

- Improve the existing editor interface.
- Implement timeline functionality.
- Improve media library.
- Implement editing panels.
- Implement video transformations.
- Implement audio and text controls.
- Integrate backend functionality.
- Improve project management UI.
- Implement export UI.
- Create the landing page.
- Create product showcase sections.
- Implement responsive layouts.
- Maintain design consistency.

The Frontend Agent owns the primary user experience.

## 8.4 Tester Agent

Primary responsibilities:

- Review existing application behavior.
- Establish regression test coverage.
- Test editing functionality.
- Test timeline operations.
- Test audio/video synchronization.
- Test export output.
- Test project saving and recovery.
- Test API integration.
- Test responsive website behavior.
- Test browser compatibility where applicable.
- Identify usability and functional defects.
- Verify acceptance criteria.

The Tester Agent should validate real editing workflows, not just isolated buttons and components.

## 8.5 Additional Agents

The PM agent may involve other available agents when their expertise is needed.

Examples:

- DevOps: Deployment, CI/CD, infrastructure.
- Security: File upload security, authentication, authorization, privacy.
- UI/UX Designer: Design system, product branding, landing page direction.
- Documentation: User guides, technical documentation.

Do not assume these agents exist.

# 9. Implementation Roadmap

The project should be delivered incrementally.

The PM Agent must refine the roadmap after completing the initial discovery phase.

## Phase 0 – Discovery and Technical Assessment

**Goal:** Understand the existing application.

Tasks:

- Analyze existing codebase.
- Document existing functionality.
- Review current architecture.
- Assess media processing.
- Identify technical debt.
- Identify missing capabilities.
- Establish baseline tests.
- Define the product roadmap.

Deliverables:

- Architecture report.
- Feature inventory.
- Technical assessment.
- Prioritized backlog.
- Implementation plan.

<badge color="success">Mandatory first phase</badge>

## Phase 1 – Foundation and Stability

**Goal:** Establish a reliable foundation for future enhancements.

Tasks:

- Fix existing critical bugs.
- Improve project data structures.
- Improve application state management.
- Establish reliable project saving.
- Establish editing history.
- Define API contracts where needed.
- Improve error handling.
- Establish regression tests.

Deliverable: A stable existing editor ready for feature expansion.

## Phase 2 – Core Professional Editing

**Goal:** Improve the primary editing experience.

Prioritized features:

1. Multiple timeline tracks.
2. Clip trimming and splitting.
3. Clip repositioning.
4. Timeline zoom and navigation.
5. Undo and redo.
6. Video transformations.
7. Audio editing.
8. Text overlays.
9. Basic transitions.
10. Color adjustments.

Deliverable: A functional professional editing workflow.

## Phase 3 – Advanced Editing and Export

**Goal:** Expand editing capabilities and output quality.

Tasks:

- Advanced timeline operations.
- Effects library.
- Audio enhancements.
- Title presets.
- Color correction improvements.
- Playback speed controls.
- Export presets.
- Export progress and error handling.
- Performance optimization.

Deliverable: A more complete editing product suitable for demonstrations.

## Phase 4 – Product Landing Page

**Goal:** Build the commercial presentation website.

Tasks:

- Define website design direction.
- Create landing page architecture.
- Implement hero section.
- Implement product showcase.
- Implement feature sections.
- Implement use-case sections.
- Add product demonstrations.
- Add FAQ.
- Add CTA sections.
- Implement footer.
- Optimize responsive behavior.
- Implement basic SEO.

Deliverable: A complete, responsive product marketing website.

## Phase 5 – Integration and Quality Assurance

**Goal:** Verify the entire product.

Tasks:

- Test editing workflows.
- Test timeline functionality.
- Test export workflows.
- Test media compatibility.
- Test save and recovery.
- Test frontend/backend integration.
- Test landing page links and navigation.
- Test mobile and desktop layouts.
- Fix critical defects.
- Perform regression testing.

Deliverable: A tested release candidate.

## Phase 6 – Commercial Presentation and Release Preparation

**Goal:** Prepare the product for presentation to potential customers.

Tasks:

- Finalize product branding.
- Capture application screenshots.
- Record demonstration videos.
- Prepare example editing projects.
- Complete product documentation.
- Review landing page messaging.
- Verify published feature claims.
- Prepare deployment.
- Review security and privacy requirements.
- Prepare release notes.

Deliverable: A polished product ready for stakeholder demonstrations and the agreed launch stage.

# 10. Prioritization Framework

The PM agent must prioritize tasks based on business value, technical dependencies, and implementation complexity.

Use the following priority levels:

| Priority | Description |
|---|---|
| P0 – Critical | Essential functionality, blockers, data integrity, core export |
| P1 – High | Core professional editing features and essential marketing experience |
| P2 – Medium | Advanced editing capabilities and additional website sections |
| P3 – Low | Nice-to-have improvements and future enhancements |

The PM agent must avoid spending significant time on advanced features while fundamental editing functionality remains unreliable.

# 11. Product Quality Requirements

The following standards apply to the entire project.

## Functional Quality

- Features must work end to end.
- Editing changes must persist.
- Export must reflect editing operations.
- Errors must be handled appropriately.
- Existing functionality must not be unnecessarily broken.

## Performance Quality

- Timeline interactions should remain responsive.
- Media loading should provide feedback.
- Preview performance should be optimized.
- Large files must be handled according to supported system limits.
- Rendering should provide progress information.
- The marketing website should load efficiently.

## Security Quality

- Uploaded files must be validated.
- File handling must be secure.
- Secrets must not be exposed.
- Authentication must be enforced where required.
- User projects must be protected according to the application's storage model.
- Public-facing forms must be protected against abuse.

## Usability Quality

- Common editing operations should be discoverable.
- Controls should have clear labels.
- Errors should be understandable.
- Important actions should provide feedback.
- The landing page should communicate the product quickly.
- The website should work across common screen sizes.

# 12. Definition of Done

The overall project can be considered complete when the following conditions are satisfied.

### Video Editor

- [ ] Existing functionality has been preserved or intentionally improved.
- [ ] Multiple tracks work correctly.
- [ ] Clip editing operations work correctly.
- [ ] Video transformations work.
- [ ] Text overlays work.
- [ ] Audio editing works.
- [ ] Transitions and effects render correctly.
- [ ] Project saving and recovery work.
- [ ] Undo and redo work.
- [ ] Export produces valid video files.
- [ ] Critical editing workflows pass testing.
- [ ] No unresolved critical defects remain.

### Landing Page

- [ ] Professional hero section is implemented.
- [ ] Product features are presented.
- [ ] Real product screenshots are included.
- [ ] Product demonstration is available where planned.
- [ ] CTA buttons work.
- [ ] Navigation works.
- [ ] Responsive behavior is verified.
- [ ] SEO fundamentals are implemented.
- [ ] Marketing claims are accurate.
- [ ] Privacy and legal requirements are addressed before public launch.

### Overall Product

- [ ] Backend and frontend integration is verified.
- [ ] Regression tests pass.
- [ ] Known limitations are documented.
- [ ] Product documentation is available.
- [ ] Deployment or demonstration environment is prepared.
- [ ] Final project review is complete.

# 13. PM Agent Operating Instructions

These instructions are mandatory throughout the project.

## Rule 1 – Understand Before Implementing

Never start major implementation without understanding the existing codebase.

## Rule 2 – Preserve Existing Functionality

The project already exists. Improve it incrementally. Avoid unnecessary rewrites.

## Rule 3 – Delegate Specialized Work

Assign backend work to Backend, frontend work to Frontend, and quality assurance to Tester.

Do not perform specialized implementation work yourself when an appropriate working agent is available.

## Rule 4 – Establish Contracts Before Parallel Work

Coordinate shared data structures, APIs, and component interfaces before assigning dependent implementation tasks.

## Rule 5 – Avoid Conflicting Changes

Do not assign multiple agents overlapping file ownership without an explicit integration strategy.

## Rule 6 – Track Every Task

Maintain a project task list with:

- Task ID.
- Description.
- Assigned agent.
- Dependencies.
- Priority.
- Status.
- Acceptance criteria.
- Deliverables.

## Rule 7 – Validate Deliverables

Require actual implementation evidence.

Do not accept statements such as "feature completed" without checking relevant code, tests, and application behavior.

## Rule 8 – Keep the Product Roadmap Updated

As new technical discoveries are made, update task priorities and dependencies.

Do not continue with an outdated plan when architectural constraints change.

## Rule 9 – Separate Product Features From Marketing Claims

Only advertise implemented and verified functionality.

Upcoming functionality must be clearly identified as planned or upcoming.

## Rule 10 – Work Incrementally

Implement, integrate, test, and stabilize features in manageable increments.

Avoid postponing all testing until the end of the project.

# 14. Required PM Deliverables

The PM agent must maintain the following project artifacts, using the existing repository conventions where possible.

| Artifact | Purpose |
|---|---|
| `PROJECT_SPEC.md` | Main product specification |
| `PROJECT_ROADMAP.md` | Development phases and milestones |
| `TASKS.md` | Master task breakdown and status |
| `ARCHITECTURE.md` | Existing and planned architecture |
| `API_CONTRACTS.md` | Shared frontend/backend contracts |
| `FEATURE_INVENTORY.md` | Existing and planned capabilities |
| `TEST_PLAN.md` | Testing strategy and acceptance coverage |
| `CHANGELOG.md` | Important implementation changes |

Do not create duplicate documentation if equivalent artifacts already exist. Update existing documents where appropriate.

# 15. Final Project Delivery

At the end of the project, the PM agent must provide a complete delivery report.

The report must contain:

1. Executive summary.
2. Original application assessment.
3. Features implemented.
4. Features improved.
5. Landing page implementation.
6. Backend changes.
7. Frontend changes.
8. Database and architecture changes.
9. Testing results.
10. Performance and reliability improvements.
11. Remaining limitations.
12. Deployment or demonstration instructions.
13. Recommended future improvements.

The final status must be one of:

- **COMPLETED:** All agreed release acceptance criteria are met and verified.
- **PARTIALLY COMPLETED:** Some agreed features remain incomplete.
- **BLOCKED:** Critical dependencies prevent further delivery.

Do not claim commercial launch readiness merely because the application builds successfully.

# 16. Final Product Vision

The goal is to deliver a cohesive software product with two equally important dimensions:

**A professional video editor that provides a reliable, enjoyable, and increasingly powerful video editing experience.**

**A compelling product website that demonstrates the application's value, builds confidence, and helps convert potential customers into users.**

The PM agent must coordinate the Backend, Frontend, Tester, and other available agents to achieve this vision through structured planning, incremental implementation, clear ownership, and continuous quality assurance.

The priority is not to implement the largest possible number of features.

The priority is to deliver a polished, reliable, demonstrable product that can confidently be presented to potential customers.