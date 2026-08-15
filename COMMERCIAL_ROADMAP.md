# PipeFlow Pro — Commercial Product Roadmap

## Product position

PipeFlow Pro is evolving from a Darcy–Weisbach calculator into an engineering decision-support platform for hydraulic design teams. The commercial product should prioritize traceable calculations, repeatable design workflows, and exportable engineering evidence rather than only adding more charts.

## Implemented in this iteration

| Area | Capability | Status |
| --- | --- | --- |
| Desktop | Hardened Electron shell with context isolation, sandboxing, disabled permission prompts, and safe external-link handling | Implemented |
| Windows delivery | NSIS installer and portable artifact configuration | Implemented |
| CI/CD | GitHub Actions quality gate and Windows release workflow for `v*.*.*` tags | Implemented |
| Hydraulic design | Minor-loss coefficients, total dynamic head, static head, hydraulic power, shaft power, and annual energy metrics | Implemented |
| API | Typed `pipeflow.hydraulicDesign` tRPC procedure with Zod validation | Implemented |
| Quality | 38 automated tests passing, including advanced design calculations | Implemented |

## Next commercial capabilities

The highest-value next releases should add a visual network editor with junctions, valves, pumps, reservoirs, and control rules; a solver for nonlinear network equations; pump-system curve intersection; transient surge screening; NPSH and cavitation checks; uncertainty and sensitivity analysis; standards-aware material and fitting libraries; PDF calculation reports with assumptions and revision history; project/workspace permissions; audit logs; offline-first local projects with encrypted sync; and an extension API for CAD/BIM integrations.

Enterprise readiness also requires a documented verification boundary. Every result should carry the equation set, units, input provenance, solver tolerance, software version, and warnings. The product must make clear that engineering approval remains with a qualified professional and should support review workflows rather than present a calculation as an automatic sign-off.

## Competitive benchmark

| Dimension | Desktop engineering competitors | PipeFlow Pro target |
| --- | --- | --- |
| Core hydraulic calculation | Strong, often specialized | Transparent Darcy–Weisbach plus extensible solver library |
| Network modeling | Mature in premium products | Visual graph editor with repeatable scenarios |
| Reporting | Usually export-focused | Auditable reports with assumptions, units, warnings, and revisions |
| Collaboration | Often file-based | Workspace permissions, review comments, and immutable audit history |
| Deployment | Windows-first | Windows installer plus web deployment and offline mode |
| Extensibility | Vendor-specific | Versioned API, import/export schemas, and plugin boundary |
| Commercial trust | Long-established validation | Published verification suite, regression tests, and benchmark cases |

## Release policy

A production release should be created only after the quality workflow passes, the installer artifacts are checksum-published, release notes describe known limitations, and the tag points to the exact reviewed commit. Code signing should be added before broad customer distribution; unsigned installers are suitable only for controlled pilot testing.
