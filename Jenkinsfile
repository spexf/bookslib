pipeline{
    agent {
        label 'main-agent'
    }
    environment {
        GITHUB_API = "https://api.github.com"
        GITHUB_REPO = "spexf/bookslib"
        CONTAINER_REGISTRY = "harbor.riq-homelab.local:5000"
        CONTAINER_SOCK = "/run/user/1001/podman/podman.sock"
        HOST_WS = sh(script: "echo '${WORKSPACE}' | sed 's|/var/jenkins_home|/opt/jenkins/data|'", returnStdout: true).trim()
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

        stage("SAST Scanning") {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                sh """
                    docker run --rm \\
                        --security-opt label=level:s0:c1022,c1023 \\
                        -v "${HOST_WS}:/src" \\
                        -v "${HOST_WS}:/output:rw" \\
                        -w /src \\
                        harbor.riq-homelab.local:5000/semgrep-custom:latest \\
                        semgrep scan \\
                            --config auto \\
                            --json \\
                            --output /output/semgrep-results.json \\
                            .
                """
                withCredentials([
                        string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
                    ]){
                        sh '/var/jenkins_home/semgrep-to-github.issue.sh ${WORKSPACE}/semgrep-results.json'
                    }
                }
            }
        }
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
                                sh "docker build --target production -t ${CONTAINER_REGISTRY}/react-frontend:${env.COMMIT_ID} ."
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
                            sh "docker push ${CONTAINER_REGISTRY}/react-frontend:${env.COMMIT_ID}"
                        }
                    }
                }
            }
        }
        stage("Trivy Checking"){
            parallel {
                stage("Testing Auth Service Images"){
                    steps {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        sh """
                                docker run --rm \
                                -v "${HOST_WS}:/output:z" \
                                -v trivy-cache:/root/.cache/ \
                                -e TRIVY_INSECURE=true \
                                aquasec/trivy:latest image \
                                --severity HIGH,CRITICAL \
                                --ignore-unfixed \
                                --format json \
                                --output /output/auth-service-${COMMIT_ID}.json \
                                --exit-code 1 \
                                --image-src remote \
                                ${CONTAINER_REGISTRY}/auth-service:${COMMIT_ID}
                            """
                        }
                        withCredentials([
                            string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
                        ]){
                            sh "/var/jenkins_home/trivy-to-github.issue.sh ${WORKSPACE}/auth-service-${COMMIT_ID}.json"
                        }
                    }
                }
                stage("Testing Book Service Images"){
                    steps {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        sh """
                            docker run --rm \
                            -v trivy-cache:/root/.cache/ \
                            -v "${HOST_WS}:/output:z" \
                            -e TRIVY_INSECURE=true \
                            aquasec/trivy:latest image \
                            --severity HIGH,CRITICAL \
                            --ignore-unfixed \
                            --format json \
                            --output /output/book-service-${COMMIT_ID}.json \
                            --exit-code 1 \
                            --image-src remote \
                            ${CONTAINER_REGISTRY}/book-service:${COMMIT_ID}
                        """
                        }
                        withCredentials([
                            string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
                        ]){
                        sh "/var/jenkins_home/trivy-to-github.issue.sh ${WORKSPACE}/book-service-${COMMIT_ID}.json"
                        }
                    }
                }
                stage("Testing Review Service Images"){
                    steps {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        sh """
                            docker run --rm \
                            -v trivy-cache:/root/.cache/ \
                            -v "${HOST_WS}:/output:z" \
                            -e TRIVY_INSECURE=true \
                            aquasec/trivy:latest image \
                            --severity HIGH,CRITICAL \
                            --ignore-unfixed \
                            --format json \
                            --output /output/review-service-${COMMIT_ID}.json \
                            --exit-code 1 \
                            --image-src remote \
                            ${CONTAINER_REGISTRY}/review-service:${COMMIT_ID}
                        """
                        }
                        withCredentials([
                            string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
                        ]){
                        sh "/var/jenkins_home/trivy-to-github.issue.sh ${WORKSPACE}/review-service-${COMMIT_ID}.json"
                        }
                    }
                }
                stage("Testing React Frontend Images"){
                    steps {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        sh """
                            docker run --rm \
                            -v trivy-cache:/root/.cache/ \
                            -v "${HOST_WS}:/output:z" \
                            -e TRIVY_INSECURE=true \
                            aquasec/trivy:latest image \
                            --severity HIGH,CRITICAL \
                            --ignore-unfixed \
                            --format json \
                            --output /output/react-frontend-${COMMIT_ID}.json \
                            --exit-code 1 \
                            --image-src remote \
                            ${CONTAINER_REGISTRY}/react-frontend:${COMMIT_ID}
                        """
                        }
                        withCredentials([
                            string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')
                        ]){
                        sh "/var/jenkins_home/trivy-to-github.issue.sh ${WORKSPACE}/react-frontend-${COMMIT_ID}.json"
                        }
                    }
                }
            } 

        }

        stage("Deploy Development"){
            when {
                branch 'development'
                expression { currentBuild.currentResult == 'SUCCESS' }
            }
            parallel {
                stage("Deploying Auth Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('auth-service'){
                            
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml && kubectl apply -f Staging.yaml"
                        }
                        }
                    }
                }
                stage("Deploying Book Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            
                            dir('books-service'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml && kubectl apply -f Staging.yaml"

                        }
                        }
                    }
                }
                stage("Deploying Review Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('reviews-service'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml && kubectl apply -f Staging.yaml"
                        }
                        }
                    }
                }
                stage("Deploying Frontend"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('frontend'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Staging.yaml && kubectl apply -f Staging.yaml"
                        }
                        }
                    }
                }
            
            }
        }
        stage("Deploy Production"){
            when {
                branch 'main'
                expression { currentBuild.currentResult == 'SUCCESS' }
            }
            
            parallel {
                stage("Deploying Auth Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('auth-service'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml && kubectl apply -f Production.yaml"
                        }
                        }
                    }
                }
                stage("Deploying Book Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('books-service'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml && kubectl apply -f Production.yaml"
                        }
                        }
                    }
                }
                stage("Deploying Review Service"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('reviews-service'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml && kubectl apply -f Production.yaml"
                        }
                        }
                    }
                }
                stage("Deploying Frontend"){
                    steps{
                        withKubeConfig([credentialsId: 'kubeconfig-riq-homelab']){
                            dir('frontend'){
                            sh "sed -i 's|\${IMAGE_TAG}|${COMMIT_ID}|g' Production.yaml && kubectl apply -f Production.yaml"
                        }
                        }
                    }
                }
            }
            
        }
        // stage("Deploy To Compose") {
        //     environment {
        //         POSTGRES_USER     = credentials('postgres-user')
        //         POSTGRES_PASSWORD = credentials('postgres-password')
        //         DB_HOST = credentials('postgres-host')
        //         POSTGRES_DB = credentials('postgres-db')
        //     }
        //     steps {
        //         sh "docker-compose -f ${env.WORKSPACE}/docker-compose.yaml down"
        //         sh "docker-compose -f ${env.WORKSPACE}/docker-compose.yaml up -d"
        //     }
        // } // TODO If have enough time, but my head hurts now :')
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
                    ${CONTAINER_REGISTRY}/react-frontend:${COMMIT_ID} -f
                    '''
            }
        }
        success{
            echo "SUCCESS"
            script {
                if (env.BRANCH_NAME != 'development' && env.BRANCH_NAME != 'main') {
                    echo "CLEANING REGISTRY..."
                    sh "/var/jenkins_home/clear-regisrty-images.sh auth-service ${env.COMMIT_ID}"
                    sh "/var/jenkins_home/clear-regisrty-images.sh book-service ${env.COMMIT_ID}"
                    sh "/var/jenkins_home/clear-regisrty-images.sh review-service ${env.COMMIT_ID}"
                    sh "/var/jenkins_home/clear-regisrty-images.sh frontend ${env.COMMIT_ID}"
                    echo "REGISTRY CLEANING COMPLETE"
                }
            }
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