pipeline{
    agent any
    environment {
        GITHUB_API = "https://api.github.com"
        GITHUB_REPO = "spexf/bookslib"
        CONTAINER_REGISTRY = "harbor.riq-homelab.local:5000"
        COMMIT_ID = ""
        CONTAINER_SOCK = "/run/user/1001/podman/podman.sock"
    }
    stages{
        stage("Checkout"){
            steps{
                // checkout scm
                // script {
                //     env.COMMIT_ID = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                //     echo "Short Commit ID yang didapat: ${env.COMMIT_ID}"
                // }

                script {
                    def scmVars = checkout scm
                    env.COMMIT_ID = env.GIT_COMMIT.take(7)
                    echo "COMMIT_ID: ${env.COMMIT_ID}"
                }
            }
        }

        // stage("SAST Scanning") {
        //     steps {
        //         sh """
        //         docker run --rm \
        //             --security-opt label=level:s0:c1022,c1023 \
        //             -v "/opt/jenkins/data/workspace/Bookslib_${BRANCH_NAME}:/src" \
        //             -v "/opt/jenkins/data/workspace/Bookslib_${BRANCH_NAME}:/output":rw \
        //             -w /src \
        //             harbor.riq-homelab.local:5000/semgrep-custom:latest \
        //             semgrep scan \
        //                 --config auto \
        //                 --json \
        //                 --output /output/semgrep-results.json \
        //                 .
        //     """
        //     }
        // }

        // stage("SAST Result Analysis") {
        //     steps {
        //         script {
        //             def results = readJSON file: 'semgrep-results.json'
        //             int totalFindings = results.results.size()
        //             echo "Total findings: ${totalFindings}"
        //             if (totalFindings > 10){    // TODO change this later
        //                 def findingsText = ""
        //                 results.results.each { finding ->
        //                     findingsText += """
        //                     ### Rule
        //                     ${finding.check_id}

        //                     ### Severity
        //                     ${finding.extra.severity}

        //                     ### File
        //                     ${finding.path}

        //                     ### Message
        //                     ${finding.extra.message}

        //                     ### Line
        //                     ${finding.start.line}

        //                     ---
                        
        //                 """
        //                 }
        //                 writeFile(
        //                     file: 'issue_body.md',
        //                     text: """
        //                     # 🚨 Semgrep Security Scan Failed

        //                     Ditemukan vulnerability / bug / issue pada hasil scanning.
        //                     ## Findings
        //                     ${findingsText}

        //                     Repository: ${env.GITHUB_REPO}

        //                     Build: ${env.BUILD_URL}
        //                     """
        //                 )
        //                 withCredentials([
        //                     string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
        //                 ]) {
        //                     sh '''
        //                     ISSUE_TITLE="🚨 Semgrep Security Findings - Build #${BUILD_NUMBER}"

        //                     ISSUE_BODY=$(cat issue_body.md | jq -Rs .)

        //                     curl -s -X POST \
        //                       -H "Authorization: token ${GITHUB_TOKEN}" \
        //                       -H "Accept: application/vnd.github+json" \
        //                       ${GITHUB_API}/repos/${GITHUB_REPO}/issues \
        //                       -d "{
        //                         \\"title\\": \\"${ISSUE_TITLE}\\",
        //                         \\"body\\": ${ISSUE_BODY}
        //                       }"
        //                     '''
        //                 }
        //                 error("Semgrep menemukan vulnerability/bug. Pipelin gagal")
        //             } else {
        //                 echo "Tidak ditemukan vuln atau bug"
        //             }
        //         }
        //     }
        // }


        
        // stage("Application Building") {
        //     parallel {
        //         stage("Building Auth Service"){
        //             steps{
        //                 dir('auth-service'){
        //                     script{
        //                         sh "docker build --target production -t ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID} ."
        //                     }
        //                 }
        //             }
        //         }
        //         stage("Building Book Service"){
        //             steps{
        //                 dir('books-service'){
        //                     script{
        //                         sh "docker build --target production -t ${CONTAINER_REGISTRY}/book-service:${env.COMMIT_ID} ."
        //                     }
        //                 }
        //             }
        //         }
        //         stage("Building Review Service"){
        //             steps{
        //                 dir('reviews-service'){
        //                     script{
        //                         sh "docker build --target production -t ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID} ."
        //                     }
        //                 }
        //             }
        //         }
        //         stage("Building Frontend"){
        //             steps{
        //                 dir('frontend'){
        //                     script{
        //                         sh "docker build --target production -t ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID} ."
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        // stage("Pushing Artifact"){
        //     parallel {
        //         stage("Deploying Auth Service"){
        //             steps {
        //                 script {
        //                     sh "docker push ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID}"
        //                 }
        //             }
        //         }
        //         stage("Deploying Book Service"){
        //             steps {
        //                 script {
        //                     sh "docker push ${CONTAINER_REGISTRY}/book-service:${env.COMMIT_ID}"
        //                 }
        //             }
        //         }
        //         stage("Deploying Review Service"){
        //             steps {
        //                 script {
        //                     sh "docker push ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID}"
        //                 }
        //             }
        //         }
        //         stage("Deploying Frontend"){
        //             steps {
        //                 script {
        //                     sh "docker push ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID}"
        //                 }
        //             }
        //         }
        //     }
        // }
        // stage('Trivy - Image Scan') {
        //     parallel {
        //         stage("Auth Service Image Scan"){
        //             steps {
        //                 sh """
        //                     docker run --rm \
        //                     -v ${CONTAINER_SOCK}:/var/run/docker.sock:z,shared \
        //                     -v trivy-cache:/root/.cache/ \
        //                     aquasec/trivy:latest image \
        //                     --severity HIGH,CRITICAL \
        //                     --exit-code 1 \
        //                     --ignore-unfixed \
        //                     --format table \
        //                     ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID}
        //                 """
        //             }
        //         }
        //         stage("Book Service Image Scan"){
        //             steps {
        //                 sh """
        //                     docker run --rm \
        //                     -v ${CONTAINER_SOCK}:/var/run/docker.sock:z,shared \
        //                     -v trivy-cache:/root/.cache/ \
        //                     aquasec/trivy:latest image \
        //                     --severity HIGH,CRITICAL \
        //                     --exit-code 1 \
        //                     --ignore-unfixed \
        //                     --format table \
        //                     ${CONTAINER_REGISTRY}/book-service:${env.COMMIT_ID}
        //                 """
        //             }
        //         }
        //         stage("Review Service Image Scan"){
        //             steps {
        //                 sh """
        //                     docker run --rm \
        //                     -v ${CONTAINER_SOCK}:/var/run/docker.sock:z,shared \
        //                     -v trivy-cache:/root/.cache/ \
        //                     aquasec/trivy:latest image \
        //                     --severity HIGH,CRITICAL \
        //                     --exit-code 1 \
        //                     --ignore-unfixed \
        //                     --format table \
        //                     ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID}
        //                 """
        //             }
        //         }
        //         stage("Frontend Service Image Scan"){
        //             steps {
        //                 sh """
        //                     docker run --rm \
        //                     -v ${CONTAINER_SOCK}:/var/run/docker.sock:z,shared \
        //                     -v trivy-cache:/root/.cache/ \
        //                     aquasec/trivy:latest image \
        //                     --severity HIGH,CRITICAL \
        //                     --exit-code 1 \
        //                     --ignore-unfixed \
        //                     --format table \
        //                     ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID}
        //                 """
        //             }
        //         }
        //     }
        // }
        // stage("Deploy Pods"){
        //     parallel {
        //         stage("Deploying Auth Service"){
        //             steps{
        //                 script {
        //                     sh "echo Deploying ... "
        //                 }
        //             }
        //         }
        //         stage("Deploying Book Service"){
        //             steps{
        //                 script {
        //                     sh "echo Deploying ... "
        //                 }
        //             }
        //         }
        //         stage("Deploying Review Service"){
        //             steps{
        //                 script {
        //                     sh "echo Deploying ... "
        //                 }
        //             }
        //         }
        //         stage("Deploying Frontend"){
        //             steps{
        //                 script {
        //                     sh "echo Deploying ... "
        //                 }
        //             }
        //         }
        //     }
        // }
    }
        
    post{
        always{
            echo "${env.COMMIT_ID}"
            // echo "Cleaning Images"
            // script {
            // sh "echo 'Cleaning Images . . .' "
            // sh '''
            //     docker rmi ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID} \
            //     ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID} \
            //     ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID} \
            //     ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID} -f
            //     '''
            // sh "./var/jenkins_home/clear-regisrty-images.sh --registry ${CONTAINER_REGISTRY} --image ${CONTAINER_REGISTRY}/auth-service --tag ${env.COMMIT_ID}"
            // sh "./var/jenkins_home/clear-regisrty-images.sh --registry ${CONTAINER_REGISTRY} --image ${CONTAINER_REGISTRY}/book-service --tag ${env.COMMIT_ID}"
            // sh "./var/jenkins_home/clear-regisrty-images.sh --registry ${CONTAINER_REGISTRY} --image ${CONTAINER_REGISTRY}/review-service --tag ${env.COMMIT_ID}"
            // sh "./var/jenkins_home/clear-regisrty-images.sh --registry ${CONTAINER_REGISTRY} --image ${CONTAINER_REGISTRY}/frontend --tag ${env.COMMIT_ID}"

        // }
        }
        success{
            echo "SUCCESS" 
        }
        failure{
            echo "FAILED"
        }

        
    }

    
}