cd dist
echo hello
git init
git add .
git commit -m "deploy wch853.github.io"
git push -f git@github.com:wch853/wch853.github.io.git master
echo deploy success
pause