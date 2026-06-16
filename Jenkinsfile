pipeline{
    agent {
        label 'main-agent'
    }
    environment {
        GITHUB_API = "https://api.github.com"
        GITHUB_REPO = "spexf/bookslib"
        CONTAINER_REGISTRY = "harbor.riq-homelab.local:5000"
        CONTAINER_SOCK = "/run/user/1001/podman/podman.sock"

    }
    stages{
        stage("Checkout"){
            steps{
                checkout scm
                script {
                    env.COMMIT_ID = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Short Commit ID yang didapat: ${env.COMMIT_ID}"
                }
            }
        }

        // stage("SAST Scanning") {
        //     steps {
        //         sh """
        //             HOST_WS=\$(echo "${WORKSPACE}" | sed 's|/var/jenkins_home|/opt/jenkins/data|')

        //             docker run --rm \\
        //                 --security-opt label=level:s0:c1022,c1023 \\
        //                 -v "\${HOST_WS}:/src" \\
        //                 -v "\${HOST_WS}:/output:rw" \\
        //                 -w /src \\
        //                 harbor.riq-homelab.local:5000/semgrep-custom:latest \\
        //                 semgrep scan \\
        //                     --config auto \\
        //                     --json \\
        //                     --output /output/semgrep-results.json \\
        //                     .
        //         """
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
        stage("Application Building") {
            parallel {
                stage("Building Auth Service"){
                    steps{
                        dir('auth-service'){
                            script{
                                sh "docker build --target production -t ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID} ."
                            }
                        }
                    }
                }
                stage("Building Book Service"){
                    steps{
                        dir('books-service'){
                            script{
                                sh "docker build --target production -t ${CONTAINER_REGISTRY}/book-service:${env.COMMIT_ID} ."
                            }
                        }
                    }
                }
                stage("Building Review Service"){
                    steps{
                        dir('reviews-service'){
                            script{
                                sh "docker build --target production -t ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID} ."
                            }
                        }
                    }
                }
                stage("Building Frontend"){
                    steps{
                        dir('frontend'){
                            script{
                                sh "docker build --target production -t ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID} ."
                            }
                        }
                    }
                }
            }
        }
        stage("Pushing Artifact"){
            parallel {
                stage("Pushing Auth Service"){
                    steps {
                        script {
                            sh "docker push ${CONTAINER_REGISTRY}/auth-service:${env.COMMIT_ID}"
                        }
                    }
                }
                stage("Pushing Book Service"){
                    steps {
                        script {
                            sh "docker push ${CONTAINER_REGISTRY}/book-service:${env.COMMIT_ID}"
                        }
                    }
                }
                stage("Pushing Review Service"){
                    steps {
                        script {
                            sh "docker push ${CONTAINER_REGISTRY}/review-service:${env.COMMIT_ID}"
                        }
                    }
                }
                stage("Pushing Frontend"){
                    steps {
                        script {
                            sh "docker push ${CONTAINER_REGISTRY}/frontend:${env.COMMIT_ID}"
                        }
                    }
                }
            }
        }
        // stage("Trivy Checking"){
        //     steps {
        //         sh """
        //             docker run --rm \
        //             -v trivy-cache:/root/.cache/ \
        //             -e TRIVY_INSECURE=true \
        //             aquasec/trivy:latest image \
        //             --severity HIGH,CRITICAL \
        //             --exit-code 1 \
        //             --ignore-unfixed \
        //             --format table \
        //             --image-src remote \
        //             ${CONTAINER_REGISTRY}/auth-service:${COMMIT_ID}
        //         """
        //         sh """
        //             docker run --rm \
        //             -v trivy-cache:/root/.cache/ \
        //             -e TRIVY_INSECURE=true \
        //             aquasec/trivy:latest image \
        //             --severity HIGH,CRITICAL \
        //             --exit-code 1 \
        //             --ignore-unfixed \
        //             --format table \
        //             --image-src remote \
        //             ${CONTAINER_REGISTRY}/book-service:${COMMIT_ID}
        //         """
        //         sh """
        //             docker run --rm \
        //             -v trivy-cache:/root/.cache/ \
        //             -e TRIVY_INSECURE=true \
        //             aquasec/trivy:latest image \
        //             --severity HIGH,CRITICAL \
        //             --exit-code 1 \
        //             --ignore-unfixed \
        //             --format table \
        //             --image-src remote \
        //             ${CONTAINER_REGISTRY}/review-service:${COMMIT_ID}
        //         """
        //         sh """
        //             docker run --rm \
        //             -v trivy-cache:/root/.cache/ \
        //             -e TRIVY_INSECURE=true \
        //             aquasec/trivy:latest image \
        //             --severity HIGH,CRITICAL \
        //             --exit-code 1 \
        //             --ignore-unfixed \
        //             --format table \
        //             --image-src remote \
        //             ${CONTAINER_REGISTRY}/frontend:${COMMIT_ID}
        //         """
        //     }        

        // }
        stage("Deploy Development"){
            when {
                branch 'development'
            }
            parallel {
                stage("Deploying Auth Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('auth-service'){
                            sh """
                                sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml | kubectl apply -f -
                            """
                        }}
                    }
                }
                stage("Deploying Book Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('books-service'){
                            sh """
                                sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml | kubectl apply -f -
                            """
                        }}
                    }
                }
                stage("Deploying Review Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('reviews-service'){
                            sh """
                                sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml | kubectl apply -f -
                            """
                        }}
                    }
                }
                stage("Deploying Frontend"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('frontend'){
                            sh """
                                sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml | kubectl apply -f -
                            """
                        }}
                    }
                }
            
            }
        }
        stage("Deploy Production"){
            when {
                branch 'main'
            }
            {
                parallel {
                    stage("Deploying Auth Service"){
                        steps{
                            withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('auth-service'){
                                sh """
                                    sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml | kubectl apply -f -
                                """
                            }}
                        }
                    }
                    stage("Deploying Book Service"){
                        steps{
                            withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('books-service'){
                                sh """
                                    sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml | kubectl apply -f -
                                """
                            }}
                        }
                    }
                    stage("Deploying Review Service"){
                        steps{
                            withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('reviews-service'){
                                sh """
                                    sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml | kubectl apply -f -
                                """
                            }}
                        }
                    }
                    stage("Deploying Frontend"){
                        steps{
                            withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){dir('frontend'){
                                sh """
                                    sed 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml | kubectl apply -f -
                                """
                            }}
                        }
                    }
                }
            }
        }
    }
        
    post{
        always{
            echo "Cleaning Images"
            script {
                sh "echo 'Cleaning Images . . .' "
                sh '''
                    docker rmi ${CONTAINER_REGISTRY}/auth-service:${COMMIT_ID} \
                    ${CONTAINER_REGISTRY}/book-service:${COMMIT_ID} \
                    ${CONTAINER_REGISTRY}/review-service:${COMMIT_ID} \
                    ${CONTAINER_REGISTRY}/frontend:${COMMIT_ID} -f
                    '''
            }
        }
        success{
            echo "SUCCESS" 
            echo "CLEANING REGISTRY..."
            sh "/var/jenkins_home/clear-regisrty-images.sh auth-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh book-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh review-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh frontend ${env.COMMIT_ID}"
            echo "REGISTRY CLEANING COMPLETE"
        }
        failure{
            echo "FAILED"
            echo "CLEANING REGISTRY..."
            sh "/var/jenkins_home/clear-regisrty-images.sh auth-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh book-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh review-service ${env.COMMIT_ID}"
            sh "/var/jenkins_home/clear-regisrty-images.sh frontend ${env.COMMIT_ID}"
            echo "REGISTRY CLEANING COMPLETE"
        }

        
    }

    
}