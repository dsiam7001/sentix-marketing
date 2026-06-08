## Goal
Make System Doctor green for GitHub by fixing the current 403 cause, securely update the GitHub PAT/repo settings, finish the remaining automation upgrades, then validate with a real diagnostic run and proof.

## Plan

1. **Fix GitHub 403 root cause**
   - Add the required `User-Agent` header to every GitHub API call.
   - Keep `Authorization: Bearer <PAT>` and GitHub API accept headers.
   - Apply this consistently in System Doctor, GitHub preflight, render dispatch, and any workflow/file sync calls.

2. **Securely request and store your GitHub config**
   - After you approve implementation, I will request these as secure secrets/values:
     - GitHub PAT
     - Repo owner
     - Repo name
   - I will not put the PAT in code or visible files.
   - Defaults will remain `dsiam7001/sentix-marketing`, but stored values will override them.

3. **Verify whether anything must be changed inside GitHub**
   - Check PAT validity.
   - Check repo access.
   - Check whether `.github/workflows/render.yml` exists.
   - Check whether the PAT has workflow dispatch access.
   - If GitHub-side permissions are missing, I will tell you exactly what must be enabled before continuing.

4. **Doctor green-light cleanup**
   - Make GitHub Doctor messages show the exact failing stage: PAT, repo, workflow file, or dispatch permission.
   - Optional missing services like AudD/AssemblyAI/Sightengine will stay `skip`, not red failures.
   - Keep real proof values in the Doctor output.

5. **Finish pending feature updates**
   - Hook Library AI replacement: remove the dependency on fixed 50 seed hooks and add AI-generated hook suggestions.
   - Performance UI: add clear manual-mark labeling and delete controls.
   - Inspiration: show only real metrics; remove fake percentage-style metrics.
   - Reference upload flow: add video/image upload entry point and vision-style analysis output for creative direction.

6. **End-to-end proof run**
   - Run/click the visible **Run diagnostic** button in the app preview.
   - Confirm GitHub PAT, repo, and render workflow checks are green or provide the exact remaining GitHub-side action needed.
   - If credentials and GitHub permissions are correct, trigger the render pipeline and verify the app records the render dispatch.
   - Final response will include what was checked and the proof status.

## Important limitation
I can prove the app successfully reaches GitHub, validates the workflow, dispatches a render job, and records delivery status. Final Telegram delivery still depends on the external GitHub Actions job completing successfully and Telegram accepting the callback, so I will verify as far as the live systems allow and report any external blocker precisely.