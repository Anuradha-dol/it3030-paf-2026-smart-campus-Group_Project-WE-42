@echo off
setlocal
if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Java\jdk-17"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)
call "%~dp0server\mvnw.cmd" -f "%~dp0server\pom.xml" spring-boot:run %*
